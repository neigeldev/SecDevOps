#!/usr/bin/env bash
# Módulo 3 · Destruir los recursos de AWS para no generar costos
# Uso: ./scripts/m3-destroy.sh app|account|all
# Destruye primero la app; account-baseline incluye recursos de auditoría que
# conviene conservar hasta el final.
source "$(dirname "$0")/lib.sh"
WHAT="${1:-app}"
need terraform
need aws

confirm() {
  read -r -p "¿Destruir '$1'? Escribe 'destruir' para confirmar: " ans
  [[ "$ans" == "destruir" ]] || die "Cancelado."
}

if [[ "$WHAT" == "app" || "$WHAT" == "all" ]]; then
  APPDIR="$ROOT/infra/terraform/app"
  confirm "app"
  # Desactivar la protección contra borrado de RDS antes de destruir
  terraform -chdir="$APPDIR" apply -auto-approve -input=false \
    -var "region=$AWS_REGION" -var "rds_deletion_protection=false" -target=aws_db_instance.main 2>/dev/null || true
  terraform -chdir="$APPDIR" destroy -auto-approve -input=false \
    -var "region=$AWS_REGION" -var "rds_deletion_protection=false"
  ok "App destruida"
fi

if [[ "$WHAT" == "account" || "$WHAT" == "all" ]]; then
  confirm "account-baseline"
  terraform -chdir="$ROOT/infra/terraform/account-baseline" destroy -auto-approve -input=false -var "region=$AWS_REGION"
  ok "Línea base de la cuenta destruida"
fi

log "Verifica en la consola que no queden recursos facturables (EC2, RDS, NAT, CloudFront)."
