#!/usr/bin/env bash
# Módulo 3 · Despliegue de SecureNotes v2 en AWS con Terraform
#   1. Crea el repositorio ECR (aplicación dirigida)
#   2. Publica la imagen en ECR
#   3. Aplica el resto del stack (VPC, RDS, EC2, CloudFront, WAF, alarmas)
# Uso: ./scripts/m3-deploy.sh            (pide confirmación de Terraform)
#      AUTO_APPROVE=1 ./scripts/m3-deploy.sh
source "$(dirname "$0")/lib.sh"
need terraform
need aws
need docker

TF_DIR="$ROOT/infra/terraform/app"
APPROVE=()
[[ "${AUTO_APPROVE:-0}" == "1" ]] && APPROVE=(-auto-approve)

log "Identidad de AWS que se usará:"
aws sts get-caller-identity --output table || die "Configura tus credenciales (aws configure / aws sso login)"

[[ -f "$TF_DIR/terraform.tfvars" ]] || { cp "$TF_DIR/terraform.tfvars.example" "$TF_DIR/terraform.tfvars"; warn "Se creó $TF_DIR/terraform.tfvars desde el ejemplo: revísalo (alert_email, owner)."; }

terraform -chdir="$TF_DIR" init -input=false

log "Paso 1/3: repositorio ECR"
terraform -chdir="$TF_DIR" apply -input=false "${APPROVE[@]}" \
  -target=aws_kms_key.main -target=aws_kms_alias.main \
  -target=aws_ecr_repository.app -target=aws_ecr_lifecycle_policy.app

log "Paso 2/3: imagen de la aplicación"
"$ROOT/scripts/m3-push-image.sh" "$(terraform -chdir="$TF_DIR" console <<<'var.image_tag' | tr -d '"')"

log "Paso 3/3: resto de la infraestructura (CloudFront tarda ~5-10 min)"
terraform -chdir="$TF_DIR" apply -input=false "${APPROVE[@]}"

URL="$(terraform -chdir="$TF_DIR" output -raw app_url)"
ok "SecureNotes desplegado: $URL"
echo
echo "  · La instancia tarda 2-4 minutos en arrancar el contenedor la primera vez."
echo "  · Contraseña del usuario admin:"
echo "      $(terraform -chdir="$TF_DIR" output -raw admin_password_command)"
echo "  · Verificación de controles: ./scripts/m3-verify.sh"
