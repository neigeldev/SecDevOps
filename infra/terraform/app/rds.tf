# Base de datos administrada: subred privada, cifrada con KMS, TLS obligatorio,
# copias de seguridad, registros exportados a CloudWatch y monitoreo mejorado.
resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_parameter_group" "main" {
  name   = "${local.name}-pg${var.db_engine_version}"
  family = "postgres${var.db_engine_version}"

  parameter {
    name  = "rds.force_ssl" # rechaza conexiones sin TLS
    value = "1"
  }
  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
  parameter {
    name  = "log_statement"
    value = "ddl"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }
}

# Grupos de logs creados de antemano para fijar cifrado y retención
resource "aws_cloudwatch_log_group" "rds" {
  for_each          = toset(["postgresql", "upgrade"])
  name              = "/aws/rds/instance/${local.name}-db/${each.key}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

data "aws_iam_policy_document" "rds_monitoring_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_monitoring" {
  name               = "${local.name}-rds-monitoring"
  assume_role_policy = data.aws_iam_policy_document.rds_monitoring_assume.json
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Performance Insights no está disponible en db.t4g.micro (ver CKV_AWS_353).
#trivy:ignore:AWS-0133
resource "aws_db_instance" "main" {
  #checkov:skip=CKV_AWS_157:Multi-AZ desactivado para mantener el entorno académico en la capa gratuita (riesgo de disponibilidad aceptado y documentado).
  #checkov:skip=CKV_AWS_353:Performance Insights no está disponible en db.t4g.micro; se usa monitoreo mejorado y logs.
  #checkov:skip=CKV_AWS_354:Performance Insights no está habilitado (ver CKV_AWS_353).
  identifier     = "${local.name}-db"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true
  kms_key_id        = aws_kms_key.main.arn

  db_name             = "securenotes"
  username            = "securenotes"
  password_wo         = ephemeral.random_password.db.result
  password_wo_version = var.secrets_version

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.main.name
  publicly_accessible    = false
  multi_az               = false
  ca_cert_identifier     = "rds-ca-rsa2048-g1"

  iam_database_authentication_enabled = true
  auto_minor_version_upgrade          = true
  backup_retention_period             = var.db_backup_retention_days
  copy_tags_to_snapshot               = true
  deletion_protection                 = var.rds_deletion_protection
  skip_final_snapshot                 = true
  apply_immediately                   = true

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn

  depends_on = [aws_cloudwatch_log_group.rds]
}
