#!/usr/bin/env bash
# Módulo 3 · Construye la imagen v2 (linux/amd64) y la publica en Amazon ECR
# Requiere que exista el repositorio ECR (lo crea scripts/m3-deploy.sh).
# Uso: ./scripts/m3-push-image.sh [tag]   (por defecto: el image_tag de Terraform, 2.0.0)
source "$(dirname "$0")/lib.sh"
need docker
need aws
need terraform

TF_DIR="$ROOT/infra/terraform/app"
REPO="$(terraform -chdir="$TF_DIR" output -raw ecr_repository_url 2>/dev/null || true)"
if [[ -z "$REPO" ]]; then
  REPO="$(aws ecr describe-repositories --region "$AWS_REGION" --repository-names securenotes \
    --query 'repositories[0].repositoryUri' --output text 2>/dev/null || true)"
fi
[[ -n "$REPO" && "$REPO" != "None" ]] || die "No existe el repositorio ECR. Ejecuta primero ./scripts/m3-deploy.sh"
TAG="${1:-2.0.0}"
REGISTRY="${REPO%%/*}"

if aws ecr describe-images --region "$AWS_REGION" --repository-name "${REPO#*/}" --image-ids imageTag="$TAG" >/dev/null 2>&1; then
  ok "La imagen $REPO:$TAG ya existe (las etiquetas son inmutables): no se vuelve a publicar"
  exit 0
fi

log "Autenticando Docker contra $REGISTRY"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null

log "Construyendo y publicando $REPO:$TAG (linux/amd64)"
docker buildx build --platform linux/amd64 -t "$REPO:$TAG" --push "$ROOT/app"
docker logout "$REGISTRY" >/dev/null 2>&1 || true

log "Resultado del escaneo de ECR (scan on push)"
aws ecr wait image-scan-complete --region "$AWS_REGION" --repository-name "${REPO#*/}" --image-id imageTag="$TAG" 2>/dev/null || true
aws ecr describe-image-scan-findings --region "$AWS_REGION" --repository-name "${REPO#*/}" --image-id imageTag="$TAG" \
  --query 'imageScanFindings.findingSeverityCounts' --output json 2>/dev/null || warn "Escaneo de ECR aún no disponible"
ok "Imagen publicada: $REPO:$TAG"
