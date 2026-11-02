variable "project" {
  description = "Nombre del proyecto; se usa como prefijo de recursos y ruta de parámetros SSM."
  type        = string
  default     = "securenotes"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,20}$", var.project))
    error_message = "Solo minúsculas, números y guiones (3 a 21 caracteres)."
  }
}

variable "environment" {
  description = "Nombre del entorno."
  type        = string
  default     = "demo"
}

variable "owner" {
  description = "Responsable de los recursos (etiqueta Owner)."
  type        = string
  default     = "devsecops-student"
}

variable "region" {
  description = "Región de AWS. CloudFront, WAF (scope CLOUDFRONT) y sus logs se gestionan desde us-east-1."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = var.region == "us-east-1"
    error_message = "Este stack usa CloudFront + WAF, que se administran desde us-east-1."
  }
}

variable "vpc_cidr" {
  description = "Bloque CIDR de la VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "Dos zonas de disponibilidad fijas (la EC2 usa la primera; RDS, ambas)."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "Se requieren exactamente dos zonas de disponibilidad."
  }
}

variable "instance_type" {
  description = "Tipo de instancia EC2 (capa gratuita: t3.micro)."
  type        = string
  default     = "t3.micro"
}

variable "db_instance_class" {
  description = "Clase de instancia RDS (capa gratuita: db.t4g.micro)."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "Versión mayor de PostgreSQL en RDS."
  type        = string
  default     = "17"
}

variable "image_tag" {
  description = "Etiqueta (inmutable) de la imagen de la app en ECR."
  type        = string
  default     = "2.0.0"
}

variable "enable_waf" {
  description = "Crea un AWS WAF con reglas administradas delante de CloudFront (costo aprox. USD 0.20/día)."
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Correo que recibe las alarmas de seguridad (SNS). Vacío = sin suscripción."
  type        = string
  default     = ""
}

variable "rds_deletion_protection" {
  description = "Protección contra borrado de RDS. scripts/m3-destroy.sh la desactiva antes de destruir."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Retención de logs en CloudWatch (CIS recomienda al menos 365 días)."
  type        = number
  default     = 365
}

variable "secrets_version" {
  description = "Incrementa este número para rotar los secretos generados (BD, JWT y administrador)."
  type        = number
  default     = 1
}

variable "db_backup_retention_days" {
  description = "Días de retención de backups automáticos de RDS. El Free plan de AWS solo permite 1."
  type        = number
  default     = 7
  validation {
    condition     = var.db_backup_retention_days >= 1 && var.db_backup_retention_days <= 35
    error_message = "Debe estar entre 1 y 35 (0 desactivaría los backups)."
  }
}
