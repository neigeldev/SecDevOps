# Monitoreo y alertas
# Logs de la app (JSON) -> filtros de métricas -> alarmas -> SNS (cifrado con KMS)
resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.project}/app"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

resource "aws_sns_topic" "alerts" {
  name              = "${local.name}-security-alerts"
  kms_master_key_id = aws_kms_key.main.id
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Eventos de seguridad que emite la app (src/logger.js)
locals {
  app_metric_filters = {
    LoginFailures = {
      pattern   = "{ $.event = \"login_failed\" }"
      threshold = 10
      desc      = "10 o mas logins fallidos en 5 minutos (posible fuerza bruta)"
    }
    SecurityEvents = {
      pattern   = "{ ($.event = \"csrf_failed\") || ($.event = \"access_denied\") || ($.event = \"origin_verify_failed\") || ($.event = \"login_rate_limited\") }"
      threshold = 5
      desc      = "Eventos de seguridad: CSRF, acceso denegado, bypass de CloudFront o limite de tasa"
    }
    ServerErrors = {
      pattern   = "{ ($.event = \"http_request\") && ($.status >= 500) }"
      threshold = 5
      desc      = "5 o mas errores 5xx en 5 minutos"
    }
  }
}

resource "aws_cloudwatch_log_metric_filter" "app" {
  for_each       = local.app_metric_filters
  name           = "${local.name}-${each.key}"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = each.value.pattern

  metric_transformation {
    name          = each.key
    namespace     = "SecureNotes"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "app" {
  for_each            = local.app_metric_filters
  alarm_name          = "${local.name}-${each.key}"
  alarm_description   = each.value.desc
  namespace           = "SecureNotes"
  metric_name         = each.key
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = each.value.threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  depends_on          = [aws_cloudwatch_log_metric_filter.app]
}

resource "aws_cloudwatch_metric_alarm" "ec2_status" {
  alarm_name          = "${local.name}-ec2-status-check"
  alarm_description   = "La instancia EC2 de la app no pasa los chequeos de estado"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.name}-rds-cpu"
  alarm_description   = "CPU de RDS sobre 80%"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.main.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
