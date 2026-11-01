# IAM a nivel de cuenta (CIS 1.x)

# Política de contraseñas para usuarios IAM (CIS 1.8 y 1.9)
resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 14
  require_lowercase_characters   = true
  require_uppercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  allow_users_to_change_password = true
  password_reuse_prevention      = 24
  max_password_age               = 90
}

data "aws_iam_policy_document" "account_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:${local.partition}:iam::${local.account_id}:root"]
    }
    dynamic "condition" {
      for_each = var.audit_role_require_mfa ? [1] : []
      content {
        test     = "Bool"
        variable = "aws:MultiFactorAuthPresent"
        values   = ["true"]
      }
    }
  }
}

# Rol para gestionar incidentes con AWS Support (CIS 1.17)
resource "aws_iam_role" "support" {
  name                 = "${var.project}-aws-support"
  description          = "Gestion de casos con AWS Support (CIS 1.17)"
  assume_role_policy   = data.aws_iam_policy_document.account_trust.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "support" {
  role       = aws_iam_role.support.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/AWSSupportAccess"
}

# Rol de solo lectura para las herramientas CSPM (Prowler y ScoutSuite):
# separa la auditoría de las credenciales de administración (mínimo privilegio).
resource "aws_iam_role" "security_audit" {
  name                 = "${var.project}-security-audit"
  description          = "Solo lectura para Prowler/ScoutSuite"
  assume_role_policy   = data.aws_iam_policy_document.account_trust.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "security_audit" {
  for_each   = toset(["SecurityAudit", "job-function/ViewOnlyAccess"])
  role       = aws_iam_role.security_audit.name
  policy_arn = "arn:${local.partition}:iam::aws:policy/${each.value}"
}

# Lecturas adicionales que usa Prowler y que no cubren las políticas administradas
data "aws_iam_policy_document" "audit_extra" {
  #checkov:skip=CKV_AWS_356:Acciones de solo lectura de auditoría que deben evaluarse sobre todos los recursos de la cuenta.
  statement {
    sid = "ProwlerAdditionalReadOnly"
    actions = [
      "account:Get*",
      "backup:Get*",
      "backup:List*",
      "cloudtrail:GetInsightSelectors",
      "ec2:GetEbsEncryptionByDefault",
      "ec2:GetInstanceMetadataDefaults",
      "ec2:GetSnapshotBlockPublicAccessState",
      "ecr:Describe*",
      "ecr:GetRegistryScanningConfiguration",
      "glue:GetConnections",
      "glue:GetSecurityConfiguration*",
      "lambda:GetFunction*",
      "logs:FilterLogEvents",
      "macie2:GetMacieSession",
      "s3:GetAccountPublicAccessBlock",
      "securityhub:GetFindings",
      "shield:DescribeProtection",
      "shield:GetSubscriptionState",
      "ssm:GetDocument",
      "support:Describe*",
      "tag:GetTagKeys",
      "wellarchitected:List*",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "security_audit_extra" {
  name   = "prowler-additional-read-only"
  role   = aws_iam_role.security_audit.id
  policy = data.aws_iam_policy_document.audit_extra.json
}

# IAM Access Analyzer: detecta recursos compartidos con entidades externas (CIS 1.20)
resource "aws_accessanalyzer_analyzer" "account" {
  count         = var.enable_access_analyzer ? 1 : 0
  analyzer_name = "${var.project}-account-analyzer"
  type          = "ACCOUNT"
}
