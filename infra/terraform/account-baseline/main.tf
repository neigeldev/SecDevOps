# Línea base de seguridad de la cuenta AWS (Módulo 3)
# Corrige a nivel de CUENTA los hallazgos de Prowler/ScoutSuite que no dependen de
# la aplicación: auditoría (CloudTrail), detección (GuardDuty, Access Analyzer),
# IAM (contraseñas, roles), cifrado por defecto y bloqueo de acceso público.
provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project
      Owner     = var.owner
      ManagedBy = "terraform"
      Module    = "M3-account-baseline"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  partition  = data.aws_partition.current.partition
  name       = "${var.project}-baseline"
  trail_name = "${var.project}-org-trail"
  trail_arn  = "arn:${local.partition}:cloudtrail:${var.region}:${local.account_id}:trail/${local.trail_name}"
}

# ---------------------------------------------------------------------------
# Clave KMS para CloudTrail, sus logs en CloudWatch y el tópico de alertas
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "kms" {
  #checkov:skip=CKV_AWS_109:Política de clave KMS: la cuenta raíz administra la clave (patrón por defecto de AWS).
  #checkov:skip=CKV_AWS_111:En una política de clave, "*" se refiere a esta misma clave.
  #checkov:skip=CKV_AWS_356:En una política de clave, "*" se refiere a esta misma clave.
  statement {
    sid       = "AccountAdministration"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:${local.partition}:iam::${local.account_id}:root"]
    }
  }

  statement {
    sid       = "CloudTrailEncryptLogs"
    actions   = ["kms:GenerateDataKey*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }
    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:aws:cloudtrail:arn"
      values   = ["arn:${local.partition}:cloudtrail:*:${local.account_id}:trail/*"]
    }
  }

  statement {
    sid       = "CloudTrailDescribeKey"
    actions   = ["kms:DescribeKey"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
  }

  statement {
    sid       = "AccountPrincipalsDecryptTrailLogs"
    actions   = ["kms:Decrypt", "kms:ReEncryptFrom"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
    condition {
      test     = "StringEquals"
      variable = "kms:CallerAccount"
      values   = [local.account_id]
    }
    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:aws:cloudtrail:arn"
      values   = ["arn:${local.partition}:cloudtrail:*:${local.account_id}:trail/*"]
    }
  }

  statement {
    sid       = "CloudWatchLogs"
    actions   = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${var.region}.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:${local.partition}:logs:${var.region}:${local.account_id}:log-group:*"]
    }
  }

  # Alarmas de CloudWatch y reglas de EventBridge publican en el SNS cifrado
  statement {
    sid       = "AlarmsAndEventsToEncryptedSns"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com", "events.amazonaws.com", "budgets.amazonaws.com"]
    }
  }
}

resource "aws_kms_key" "baseline" {
  description             = "${local.name}: CloudTrail, logs de auditoria y alertas"
  enable_key_rotation     = true
  deletion_window_in_days = 7
  policy                  = data.aws_iam_policy_document.kms.json
}

resource "aws_kms_alias" "baseline" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.baseline.key_id
}

# ---------------------------------------------------------------------------
# Tópico de alertas de seguridad
# ---------------------------------------------------------------------------
resource "aws_sns_topic" "security" {
  name              = "${local.name}-security-alerts"
  kms_master_key_id = aws_kms_key.baseline.id
}

data "aws_iam_policy_document" "sns" {
  statement {
    sid       = "AllowAccountServices"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.security.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com", "events.amazonaws.com", "budgets.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

resource "aws_sns_topic_policy" "security" {
  arn    = aws_sns_topic.security.arn
  policy = data.aws_iam_policy_document.sns.json
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.security.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
