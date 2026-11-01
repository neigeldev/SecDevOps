output "cloudtrail_name" {
  description = "Trail multirregión"
  value       = aws_cloudtrail.main.name
}

output "cloudtrail_bucket" {
  description = "Bucket cifrado con los registros de CloudTrail"
  value       = aws_s3_bucket.trail.id
}

output "security_audit_role_arn" {
  description = "Rol de solo lectura para Prowler y ScoutSuite"
  value       = aws_iam_role.security_audit.arn
}

output "security_alerts_topic_arn" {
  description = "Tópico SNS de alertas (CIS, GuardDuty, presupuesto)"
  value       = aws_sns_topic.security.arn
}

output "cis_alarms" {
  description = "Alarmas CIS creadas"
  value       = sort([for a in aws_cloudwatch_metric_alarm.cis : a.alarm_name])
}

output "manual_steps" {
  description = "Controles que no se pueden automatizar con Terraform"
  value = [
    "Activar MFA en el usuario raíz (CIS 1.5) y no usarlo en el día a día (CIS 1.7).",
    "Eliminar las llaves de acceso del usuario raíz si existen (CIS 1.4).",
    "Usar un usuario IAM o IAM Identity Center con MFA para administrar (CIS 1.10).",
    "Confirmar la suscripción de correo del tópico SNS (llega un email de AWS).",
  ]
}
