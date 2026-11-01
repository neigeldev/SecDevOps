# Clave KMS administrada por el cliente (CMK) para cifrar en reposo:
# EBS, RDS, ECR, parámetros SSM, logs de CloudWatch y el tópico SNS.
data "aws_iam_policy_document" "kms" {
  #checkov:skip=CKV_AWS_109:Política de clave KMS: la cuenta raíz administra la clave (patrón por defecto de AWS); "*" se refiere a esta misma clave.
  #checkov:skip=CKV_AWS_111:Política de clave KMS: "*" se refiere a esta misma clave.
  #checkov:skip=CKV_AWS_356:En una política de clave, el recurso "*" se refiere a esta misma clave.
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
    sid       = "CloudWatchLogs"
    actions   = ["kms:Encrypt*", "kms:Decrypt*", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:Describe*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${local.region}.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:${local.partition}:logs:${local.region}:${local.account_id}:log-group:*"]
    }
  }

  # Las alarmas de CloudWatch publican en el tópico SNS cifrado
  statement {
    sid       = "CloudWatchAlarmsToEncryptedSns"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
  }
}

resource "aws_kms_key" "main" {
  description             = "${local.name}: cifrado de datos de la aplicacion"
  enable_key_rotation     = true # rotación automática anual del material de clave
  deletion_window_in_days = 7
  policy                  = data.aws_iam_policy_document.kms.json
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.main.key_id
}
