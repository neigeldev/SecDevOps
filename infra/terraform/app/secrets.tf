# Gestión de secretos
# - Los secretos se generan con recursos EFÍMEROS y se escriben con argumentos de
#   SOLO ESCRITURA (*_wo): Terraform no los guarda en el archivo de estado.
# - Se almacenan en SSM Parameter Store como SecureString cifrados con la CMK.
# - La EC2 los lee en el arranque (rol IAM de mínimo privilegio) y los deja en tmpfs.
# - Para rotarlos: incrementa var.secrets_version y vuelve a aplicar.

ephemeral "random_password" "db" {
  length  = 32
  special = false
}

ephemeral "random_password" "jwt" {
  length  = 64
  special = false
}

ephemeral "random_password" "admin" {
  length  = 20
  special = false
}

resource "aws_ssm_parameter" "db_password" {
  name             = "${local.ssm_prefix}/db_password"
  description      = "Contrasena del usuario de la base de datos"
  type             = "SecureString"
  key_id           = aws_kms_key.main.arn
  value_wo         = ephemeral.random_password.db.result
  value_wo_version = var.secrets_version
}

resource "aws_ssm_parameter" "jwt_secret" {
  name             = "${local.ssm_prefix}/jwt_secret"
  description      = "Clave HMAC para firmar las sesiones JWT"
  type             = "SecureString"
  key_id           = aws_kms_key.main.arn
  value_wo         = ephemeral.random_password.jwt.result
  value_wo_version = var.secrets_version
}

resource "aws_ssm_parameter" "admin_password" {
  name             = "${local.ssm_prefix}/admin_password"
  description      = "Contrasena inicial del administrador de la app"
  type             = "SecureString"
  key_id           = aws_kms_key.main.arn
  value_wo         = ephemeral.random_password.admin.result
  value_wo_version = var.secrets_version
}

# El secreto de origen se comparte con CloudFront (encabezado personalizado), por
# lo que Terraform necesita conocerlo: este sí queda en el estado. Protege el estado
# (backend S3 cifrado) o rótalo con: terraform apply -replace=random_password.origin_verify
resource "random_password" "origin_verify" {
  length  = 40
  special = false
}

resource "aws_ssm_parameter" "origin_verify" {
  name        = "${local.ssm_prefix}/origin_verify_secret"
  description = "Encabezado secreto que CloudFront envia al origen"
  type        = "SecureString"
  key_id      = aws_kms_key.main.arn
  value       = random_password.origin_verify.result
}
