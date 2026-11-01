variable "project" {
  description = "Prefijo de los recursos."
  type        = string
  default     = "securenotes"
}

variable "owner" {
  description = "Responsable (etiqueta Owner)."
  type        = string
  default     = "devsecops-student"
}

variable "region" {
  description = "Región principal (donde viven el trail, los logs y las alarmas)."
  type        = string
  default     = "us-east-1"
}

variable "alert_email" {
  description = "Correo para alarmas de seguridad, hallazgos de GuardDuty y presupuesto. Vacío = sin suscripción."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Retención de los logs de CloudTrail en CloudWatch (CIS: >= 365)."
  type        = number
  default     = 365
}

variable "enable_s3_data_events" {
  description = "Registra eventos de datos de S3 en CloudTrail (CIS 3.8/3.9). Costo bajo en cuentas con poco tráfico."
  type        = bool
  default     = true
}

variable "enable_guardduty" {
  description = "Habilita Amazon GuardDuty (30 días de prueba gratis). Pon false si ya existe un detector."
  type        = bool
  default     = true
}

variable "enable_access_analyzer" {
  description = "Habilita IAM Access Analyzer de cuenta (gratis). Pon false si ya existe uno en la región."
  type        = bool
  default     = true
}

variable "enable_securityhub" {
  description = "Habilita AWS Security Hub con el estándar CIS v3.0 (30 días de prueba; luego tiene costo)."
  type        = bool
  default     = false
}

variable "enable_config" {
  description = "Habilita AWS Config (inventario y cambios de configuración; costo por ítem registrado)."
  type        = bool
  default     = false
}

variable "harden_default_vpc" {
  description = "Quita las reglas del SG por defecto y activa Flow Logs en la VPC por defecto de la región, si existe."
  type        = bool
  default     = true
}

variable "monthly_budget_usd" {
  description = "Presupuesto mensual (USD) para recibir alertas de costo. Requiere alert_email."
  type        = number
  default     = 10
}

variable "security_contact" {
  description = "Contacto de seguridad alternativo de la cuenta (CIS 1.2). Deja email vacío para omitirlo."
  type = object({
    name  = string
    title = string
    email = string
    phone = string
  })
  default = {
    name  = ""
    title = "Security"
    email = ""
    phone = ""
  }
}

variable "audit_role_require_mfa" {
  description = "Exige MFA para asumir el rol de auditoría usado por Prowler/ScoutSuite."
  type        = bool
  default     = false
}
