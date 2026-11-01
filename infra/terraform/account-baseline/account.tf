# Controles preventivos y de detección a nivel de cuenta

# Cifrado de EBS por defecto en la región (CIS 2.2.1)
resource "aws_ebs_encryption_by_default" "on" {
  enabled = true
}

# Bloqueo de acceso público de S3 para toda la cuenta (CIS 2.1.4)
resource "aws_s3_account_public_access_block" "on" {
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IMDSv2 por defecto para nuevas instancias
resource "aws_ec2_instance_metadata_defaults" "imdsv2" {
  http_tokens                 = "required"
  http_put_response_hop_limit = 2
}

# Las instantáneas de EBS no se pueden compartir públicamente
resource "aws_ebs_snapshot_block_public_access" "on" {
  state = "block-all-sharing"
}

# Consola serie de EC2 deshabilitada
resource "aws_ec2_serial_console_access" "off" {
  enabled = false
}

# ---------- Amazon GuardDuty: detección de amenazas ----------
resource "aws_guardduty_detector" "main" {
  #checkov:skip=CKV2_AWS_3:Cuenta independiente (sin AWS Organizations); no aplica la configuración de GuardDuty a nivel de organización.
  count                        = var.enable_guardduty ? 1 : 0
  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"
}

# Hallazgos de severidad alta (>= 7) de GuardDuty -> SNS
resource "aws_cloudwatch_event_rule" "guardduty_high" {
  count       = var.enable_guardduty ? 1 : 0
  name        = "${local.name}-guardduty-high"
  description = "Hallazgos de GuardDuty con severidad alta"
  event_pattern = jsonencode({
    source        = ["aws.guardduty"]
    "detail-type" = ["GuardDuty Finding"]
    detail        = { severity = [{ numeric = [">=", 7] }] }
  })
}

resource "aws_cloudwatch_event_target" "guardduty_high" {
  count = var.enable_guardduty ? 1 : 0
  rule  = aws_cloudwatch_event_rule.guardduty_high[0].name
  arn   = aws_sns_topic.security.arn
}

# ---------- AWS Security Hub (opcional) ----------
resource "aws_securityhub_account" "main" {
  count                    = var.enable_securityhub ? 1 : 0
  enable_default_standards = false
}

resource "aws_securityhub_standards_subscription" "cis" {
  count         = var.enable_securityhub ? 1 : 0
  standards_arn = "arn:${local.partition}:securityhub:${var.region}::standards/cis-aws-foundations-benchmark/v/3.0.0"
  depends_on    = [aws_securityhub_account.main]
}

# ---------- AWS Config (opcional) ----------
data "aws_iam_policy_document" "config_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["config.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "config" {
  count              = var.enable_config ? 1 : 0
  name               = "${local.name}-config"
  assume_role_policy = data.aws_iam_policy_document.config_assume.json
}

resource "aws_iam_role_policy_attachment" "config" {
  count      = var.enable_config ? 1 : 0
  role       = aws_iam_role.config[0].name
  policy_arn = "arn:${local.partition}:iam::aws:policy/service-role/AWS_ConfigRole"
}

data "aws_iam_policy_document" "config_kms" {
  statement {
    actions   = ["kms:GenerateDataKey", "kms:Decrypt"]
    resources = [aws_kms_key.baseline.arn]
  }
}

resource "aws_iam_role_policy" "config_kms" {
  count  = var.enable_config ? 1 : 0
  name   = "use-baseline-kms"
  role   = aws_iam_role.config[0].id
  policy = data.aws_iam_policy_document.config_kms.json
}

resource "aws_config_configuration_recorder" "main" {
  count    = var.enable_config ? 1 : 0
  name     = "${local.name}-recorder"
  role_arn = aws_iam_role.config[0].arn
  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "main" {
  count          = var.enable_config ? 1 : 0
  name           = "${local.name}-delivery"
  s3_bucket_name = aws_s3_bucket.trail.id
  s3_key_prefix  = "config"
  s3_kms_key_arn = aws_kms_key.baseline.arn
  depends_on     = [aws_config_configuration_recorder.main, aws_s3_bucket_policy.trail]
}

resource "aws_config_configuration_recorder_status" "main" {
  count      = var.enable_config ? 1 : 0
  name       = aws_config_configuration_recorder.main[0].name
  is_enabled = true
  depends_on = [aws_config_delivery_channel.main]
}

# ---------- VPC por defecto de la región ----------
# CIS 5.4: el SG por defecto no debe permitir tráfico. Se recomienda además borrar
# la VPC por defecto si no se usa; aquí solo se endurece (no se crea ni se borra).
data "aws_vpcs" "default" {
  filter {
    name   = "is-default"
    values = ["true"]
  }
}

resource "aws_default_security_group" "default_vpc" {
  for_each = var.harden_default_vpc ? toset(data.aws_vpcs.default.ids) : toset([])
  vpc_id   = each.value
  tags     = { Name = "default-deny-all" }
}

resource "aws_cloudwatch_log_group" "default_vpc_flow_logs" {
  count             = var.harden_default_vpc && length(data.aws_vpcs.default.ids) > 0 ? 1 : 0
  name              = "/${var.project}/default-vpc-flow-logs"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.baseline.arn
}

data "aws_iam_policy_document" "flow_logs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

resource "aws_iam_role" "default_vpc_flow_logs" {
  count              = var.harden_default_vpc && length(data.aws_vpcs.default.ids) > 0 ? 1 : 0
  name               = "${local.name}-default-vpc-flow-logs"
  assume_role_policy = data.aws_iam_policy_document.flow_logs_assume.json
}

resource "aws_iam_role_policy" "default_vpc_flow_logs" {
  count = var.harden_default_vpc && length(data.aws_vpcs.default.ids) > 0 ? 1 : 0
  name  = "write-flow-logs"
  role  = aws_iam_role.default_vpc_flow_logs[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
      Resource = "${aws_cloudwatch_log_group.default_vpc_flow_logs[0].arn}:*"
    }]
  })
}

resource "aws_flow_log" "default_vpc" {
  for_each        = var.harden_default_vpc ? toset(data.aws_vpcs.default.ids) : toset([])
  vpc_id          = each.value
  traffic_type    = "REJECT"
  log_destination = aws_cloudwatch_log_group.default_vpc_flow_logs[0].arn
  iam_role_arn    = aws_iam_role.default_vpc_flow_logs[0].arn
}

# ---------- Contacto de seguridad y presupuesto ----------
resource "aws_account_alternate_contact" "security" {
  count                  = var.security_contact.email == "" ? 0 : 1
  alternate_contact_type = "SECURITY"
  name                   = var.security_contact.name
  title                  = var.security_contact.title
  email_address          = var.security_contact.email
  phone_number           = var.security_contact.phone
}

resource "aws_budgets_budget" "monthly" {
  count        = var.alert_email == "" ? 0 : 1
  name         = "${var.project}-monthly-cost"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
