# CloudTrail multirregión (CIS 3.1-3.7): validación de integridad, cifrado KMS,
# integración con CloudWatch Logs y bucket de logs endurecido con registro de acceso.

# ---------- Bucket de registros de acceso S3 (destino del server access logging) ----------
resource "aws_s3_bucket" "access_logs" {
  #checkov:skip=CKV_AWS_18:Es el bucket destino de los registros de acceso; registrarlo en sí mismo generaría un bucle.
  #checkov:skip=CKV_AWS_144:La replicación entre regiones no se requiere en el entorno académico.
  #checkov:skip=CKV_AWS_145:El destino de server access logging solo admite SSE-S3 (AES-256), no SSE-KMS.
  #checkov:skip=CKV2_AWS_62:No se requieren notificaciones de eventos para este bucket.
  bucket        = "${var.project}-s3-access-logs-${local.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_ownership_controls" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket                  = aws_s3_bucket.access_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  rule {
    id     = "expirar-registros"
    status = "Enabled"
    filter {}
    expiration {
      days = 365
    }
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

data "aws_iam_policy_document" "access_logs" {
  statement {
    sid       = "S3ServerAccessLogsDelivery"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.access_logs.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["logging.s3.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.access_logs.arn, "${aws_s3_bucket.access_logs.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "access_logs" {
  bucket     = aws_s3_bucket.access_logs.id
  policy     = data.aws_iam_policy_document.access_logs.json
  depends_on = [aws_s3_bucket_public_access_block.access_logs]
}

# ---------- Bucket de CloudTrail ----------
resource "aws_s3_bucket" "trail" {
  #checkov:skip=CKV_AWS_144:La replicación entre regiones no se requiere en el entorno académico.
  #checkov:skip=CKV2_AWS_62:No se requieren notificaciones de eventos; las alertas salen de CloudWatch.
  bucket        = "${var.project}-cloudtrail-${local.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_ownership_controls" "trail" {
  bucket = aws_s3_bucket.trail.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "trail" {
  bucket                  = aws_s3_bucket.trail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "trail" {
  bucket = aws_s3_bucket.trail.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "trail" {
  bucket = aws_s3_bucket.trail.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.baseline.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_logging" "trail" {
  bucket        = aws_s3_bucket.trail.id
  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "cloudtrail-bucket/"
}

resource "aws_s3_bucket_lifecycle_configuration" "trail" {
  bucket = aws_s3_bucket.trail.id
  rule {
    id     = "archivar-y-expirar"
    status = "Enabled"
    filter {}
    transition {
      days          = 90
      storage_class = "GLACIER"
    }
    expiration {
      days = 730
    }
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

data "aws_iam_policy_document" "trail_bucket" {
  statement {
    sid       = "CloudTrailAclCheck"
    actions   = ["s3:GetBucketAcl"]
    resources = [aws_s3_bucket.trail.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }
  }

  statement {
    sid       = "CloudTrailWrite"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.trail.arn}/AWSLogs/${local.account_id}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }
  }

  dynamic "statement" {
    for_each = var.enable_config ? [1] : []
    content {
      sid       = "AWSConfigBucketCheck"
      actions   = ["s3:GetBucketAcl", "s3:ListBucket"]
      resources = [aws_s3_bucket.trail.arn]
      principals {
        type        = "Service"
        identifiers = ["config.amazonaws.com"]
      }
      condition {
        test     = "StringEquals"
        variable = "aws:SourceAccount"
        values   = [local.account_id]
      }
    }
  }

  dynamic "statement" {
    for_each = var.enable_config ? [1] : []
    content {
      sid       = "AWSConfigWrite"
      actions   = ["s3:PutObject"]
      resources = ["${aws_s3_bucket.trail.arn}/config/AWSLogs/${local.account_id}/Config/*"]
      principals {
        type        = "Service"
        identifiers = ["config.amazonaws.com"]
      }
      condition {
        test     = "StringEquals"
        variable = "s3:x-amz-acl"
        values   = ["bucket-owner-full-control"]
      }
      condition {
        test     = "StringEquals"
        variable = "aws:SourceAccount"
        values   = [local.account_id]
      }
    }
  }

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.trail.arn, "${aws_s3_bucket.trail.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "trail" {
  bucket     = aws_s3_bucket.trail.id
  policy     = data.aws_iam_policy_document.trail_bucket.json
  depends_on = [aws_s3_bucket_public_access_block.trail]
}

# ---------- Integración con CloudWatch Logs ----------
resource "aws_cloudwatch_log_group" "trail" {
  name              = "/aws/cloudtrail/${local.trail_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.baseline.arn
}

data "aws_iam_policy_document" "trail_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceArn"
      values   = [local.trail_arn]
    }
  }
}

resource "aws_iam_role" "trail_to_cloudwatch" {
  name               = "${local.name}-cloudtrail-to-cloudwatch"
  assume_role_policy = data.aws_iam_policy_document.trail_assume.json
}

data "aws_iam_policy_document" "trail_to_cloudwatch" {
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.trail.arn}:*"]
  }
}

resource "aws_iam_role_policy" "trail_to_cloudwatch" {
  name   = "write-cloudtrail-logs"
  role   = aws_iam_role.trail_to_cloudwatch.id
  policy = data.aws_iam_policy_document.trail_to_cloudwatch.json
}

# ---------- El trail ----------
resource "aws_cloudtrail" "main" {
  #checkov:skip=CKV_AWS_252:Las notificaciones se cubren con filtros de métricas y alarmas sobre CloudWatch Logs.
  name                          = local.trail_name
  s3_bucket_name                = aws_s3_bucket.trail.id
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_log_file_validation    = true
  kms_key_id                    = aws_kms_key.baseline.arn
  cloud_watch_logs_group_arn    = "${aws_cloudwatch_log_group.trail.arn}:*"
  cloud_watch_logs_role_arn     = aws_iam_role.trail_to_cloudwatch.arn

  advanced_event_selector {
    name = "Eventos de administracion"
    field_selector {
      field  = "eventCategory"
      equals = ["Management"]
    }
  }

  dynamic "advanced_event_selector" {
    for_each = var.enable_s3_data_events ? [1] : []
    content {
      name = "Eventos de datos de S3 (excepto los buckets de logs)"
      field_selector {
        field  = "eventCategory"
        equals = ["Data"]
      }
      field_selector {
        field  = "resources.type"
        equals = ["AWS::S3::Object"]
      }
      field_selector {
        field           = "resources.ARN"
        not_starts_with = ["${aws_s3_bucket.trail.arn}/", "${aws_s3_bucket.access_logs.arn}/"]
      }
    }
  }

  depends_on = [aws_s3_bucket_policy.trail, aws_iam_role_policy.trail_to_cloudwatch]
}
