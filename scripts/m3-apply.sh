#!/usr/bin/env bash
# Módulo 3 · Despliegue en AWS
#   account   -> aplica la línea base de seguridad de la cuenta
#   app       -> construye y publica la imagen y despliega la app (CloudFront+EC2+RDS)
#   all       -> ambos
# Uso: ./scripts/m3-apply.sh account|app|all
source "$(dirname "$0")/lib.sh"
WHAT="${1:-all}"
need terraform
need aws
need docker

aws sts get-caller-identity >/dev/null 2>&1 || die "Sin credenciales de AWS. Ejecuta 'aws configure' o 'aws sso login'."
ACC="$(aws sts get-caller-identity --query Account --output text)"
log "Cuenta AWS: $ACC · región: $AWS_REGION"

apply_dir() {
  local dir="$1"
  shift
  log "terraform init/apply en $dir"
  terraform -chdir="$dir" init -input=false >/dev/null
  terraform -chdir="$dir" apply -auto-approve -input=false "$@"
}

if [[ "$WHAT" == "account" || "$WHAT" == "all" ]]; then
  apply_dir "$ROOT/infra/terraform/account-baseline" -var "region=$AWS_REGION"
  ok "Línea base de la cuenta aplicada"
fi

if [[ "$WHAT" == "app" || "$WHAT" == "all" ]]; then
  APPDIR="$ROOT/infra/terraform/app"
  # 1) Crear primero ECR (y el resto) para conocer la URL del repositorio
  apply_dir "$APPDIR" -var "region=$AWS_REGION" -target=aws_ecr_repository.app
  TAG="$(terraform -chdir="$APPDIR" output -raw image 2>/dev/null | sed 's/.*://')"
  TAG="${TAG:-2.0.0}"

  # 2) Construir y publicar la imagen endurecida
  #    (si la etiqueta ya existe en ECR se omite: las etiquetas son inmutables)
  "$ROOT/scripts/m3-push-image.sh" "$TAG"

  # 3) Aplicar el resto de la infraestructura
  apply_dir "$APPDIR" -var "region=$AWS_REGION" -var "image_tag=$TAG"
  echo
  ok "Despliegue completo"
  terraform -chdir="$APPDIR" output
  echo
  log "La instancia tarda 2-4 minutos en descargar la imagen y arrancar el servicio."
fi
