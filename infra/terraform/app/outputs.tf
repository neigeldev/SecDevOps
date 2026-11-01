output "app_url" {
  description = "URL pública (HTTPS) de la aplicación"
  value       = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "ecr_repository_url" {
  description = "Repositorio ECR donde se publica la imagen"
  value       = aws_ecr_repository.app.repository_url
}

output "image" {
  description = "Imagen que ejecuta la instancia"
  value       = local.image
}

output "instance_id" {
  description = "ID de la instancia EC2"
  value       = aws_instance.app.id
}

output "origin_public_dns" {
  description = "DNS público de la EC2 (el acceso directo debe fallar: solo CloudFront)"
  value       = aws_instance.app.public_dns
}

output "rds_endpoint" {
  description = "Endpoint privado de RDS (no accesible desde Internet)"
  value       = aws_db_instance.main.address
}

output "ssm_session_command" {
  description = "Acceso administrativo sin SSH (requiere el plugin de Session Manager)"
  value       = "aws ssm start-session --region ${local.region} --target ${aws_instance.app.id}"
}

output "admin_password_command" {
  description = "Comando para leer la contraseña inicial del administrador"
  value       = "aws ssm get-parameter --region ${local.region} --name ${aws_ssm_parameter.admin_password.name} --with-decryption --query Parameter.Value --output text"
}

output "alerts_topic_arn" {
  description = "Tópico SNS de alertas de seguridad"
  value       = aws_sns_topic.alerts.arn
}
