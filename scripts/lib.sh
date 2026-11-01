#!/usr/bin/env bash
# Funciones y versiones comunes para todos los scripts del proyecto.
# Uso: source "$(dirname "$0")/lib.sh"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---- Compatibilidad Windows (Git Bash / MSYS2 / Cygwin) ----
# Git Bash convierte automáticamente rutas /ruta -> C:\ruta en argumentos de Docker.
# MSYS_NO_PATHCONV=1 desactiva esa conversión; cygpath -m da rutas mixtas que Docker
# Desktop acepta en lugar de rutas POSIX puras que Git Bash reescribiría.
IS_WINDOWS=0
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    IS_WINDOWS=1
    export MSYS_NO_PATHCONV=1
    export MSYS2_ARG_CONV_EXCL='*'
    ROOT="$(cygpath -m "$ROOT")"
    ;;
esac

# En Windows, --user "$(id -u):$(id -g)" produce valores sin sentido.
# Los scripts usan "${DOCKER_USER[@]}" en su lugar.
if [[ "$IS_WINDOWS" == 0 ]]; then
  DOCKER_USER=(--user "$(id -u):$(id -g)")
else
  DOCKER_USER=()
fi

REPORTS="$ROOT/reports"
CACHE="$ROOT/.cache"

# Claves locales (NVD_API_KEY, SONAR_TOKEN, ...) en un archivo ignorado por Git
if [[ -f "$ROOT/.secrets.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.secrets.env"
  set +a
fi

# ---- Versiones fijadas de las herramientas (reproducibilidad) ----
SEMGREP_IMAGE="semgrep/semgrep:1.183.0"
SONARQUBE_IMAGE="sonarqube:26.10.0.133078-community"
SONAR_SCANNER_IMAGE="sonarsource/sonar-scanner-cli:12.3.0.4285_8.1.0"
DEPCHECK_IMAGE="owasp/dependency-check:12.2.2"
ZAP_IMAGE="${ZAP_IMAGE:-zaproxy/zap-stable:2.16.1}"  # alternativa oficial: ghcr.io/zaproxy/zaproxy:2.16.1
NODE_IMAGE="node:24.22.2-trixie-slim"
CHECKOV_IMAGE="bridgecrew/checkov:3.4.0"
TRIVY_IMAGE="aquasec/trivy:0.76.1"
HADOLINT_IMAGE="hadolint/hadolint:v2.15.1"
PROWLER_IMAGE="toniblyx/prowler:5.47.0"
SCOUTSUITE_VERSION="5.14.0"
PYTHON_IMAGE="python:3.11-slim"

AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

log()  { echo -e "\033[1;34m[$(date +%H:%M:%S)]\033[0m $*" >&2; }
ok()   { echo -e "\033[1;32m  ✔\033[0m $*" >&2; }
warn() { echo -e "\033[1;33m  !\033[0m $*" >&2; }
die()  { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "Falta '$1'. Revisa la sección de requisitos del README."
}

# Valida el argumento de versión: v1 (línea base vulnerable) o v2 (versión segura)
check_version() {
  [[ "${1:-}" == "v1" || "${1:-}" == "v2" ]] || die "Indica la versión: v1 (vulnerable) o v2 (segura)"
}

# Referencia Git de la línea base vulnerable: el tag v1.0-vulnerable o, si no
# existe (p. ej. no se subieron los tags), el commit marcado con [v1.0-vulnerable].
v1_ref() {
  if git -C "$ROOT" rev-parse -q --verify "refs/tags/v1.0-vulnerable" >/dev/null; then
    echo "v1.0-vulnerable"
  else
    local c
    c="$(git -C "$ROOT" log --all --format=%H --grep='^\[v1.0-vulnerable\]' | tail -1)"
    [[ -n "$c" ]] || die "No se encontró la línea base v1 (tag v1.0-vulnerable)."
    echo "$c"
  fi
}

# Carpeta con el código de la versión pedida.
# v2 = esta copia de trabajo; v1 = git worktree en .worktrees/v1 (sin tocar tu rama)
src_dir() {
  check_version "$1"
  if [[ "$1" == "v2" ]]; then
    echo "$ROOT"
    return
  fi
  local wt="$ROOT/.worktrees/v1"
  if [[ ! -e "$wt/app/package.json" ]]; then
    log "Preparando copia de la versión v1 en .worktrees/v1"
    git -C "$ROOT" worktree prune
    git -C "$ROOT" worktree add --force --detach "$wt" "$(v1_ref)" >/dev/null 2>&1 \
      || die "No se pudo crear el worktree de v1"
  fi
  echo "$wt"
}

# Carpeta de reportes: reports/<módulo>/<versión o etapa>
report_dir() {
  local d="$REPORTS/$1/$2"
  mkdir -p "$d"
  echo "$d"
}

# Credenciales AWS para contenedores (Prowler/ScoutSuite): exporta las de tu perfil
# (incluye SSO) como variables de entorno.
aws_env_args() {
  need aws
  local creds
  creds="$(aws configure export-credentials --format env 2>/dev/null)" \
    || die "No hay credenciales de AWS. Ejecuta 'aws configure' o 'aws sso login'."
  eval "$creds"
  local args=(-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e "AWS_DEFAULT_REGION=$AWS_REGION" -e "AWS_REGION=$AWS_REGION")
  [[ -n "${AWS_SESSION_TOKEN:-}" ]] && args+=(-e AWS_SESSION_TOKEN)
  printf '%s\n' "${args[@]}"
}

# Asume el rol de auditoría de solo lectura si existe (creado por account-baseline)
assume_audit_role_if_present() {
  local arn
  arn="$(aws iam get-role --role-name securenotes-security-audit --query Role.Arn --output text 2>/dev/null || true)"
  if [[ -n "$arn" && "$arn" != "None" ]]; then
    log "Usando el rol de auditoría de solo lectura: $arn"
    local out
    out="$(aws sts assume-role --role-arn "$arn" --role-session-name cspm-scan \
      --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' --output text)"
    export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
    read -r AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN <<<"$out"
    unset AWS_PROFILE
  else
    warn "Rol de auditoría no encontrado: se usan tus credenciales actuales (normal antes de aplicar account-baseline)."
  fi
}

# ---- Entorno local de la app (docker compose) por versión ----
stack_project() { echo "securenotes-$1"; }
stack_compose() { echo "$(src_dir "$1")/infra/docker/docker-compose.yml"; }
stack_url()     { if [[ "$1" == "v1" ]]; then echo "http://localhost:3000"; else echo "https://localhost:8443"; fi; }
stack_target()  { echo "http://app:3000"; }  # DAST apunta a la app (Módulo 1 evalúa el código, no el proxy TLS)
stack_network() { if [[ "$1" == "v1" ]]; then echo "securenotes-v1_default"; else echo "securenotes-v2_frontend"; fi; }

stack_up() {
  local v="$1" build=(--build)
  [[ "${NO_BUILD:-0}" == "1" ]] && build=(--no-build)
  [[ "$v" == "v2" ]] && "$ROOT/scripts/gen-secrets.sh" >/dev/null
  log "Levantando SecureNotes $v (docker compose)"
  docker compose -f "$(stack_compose "$v")" -p "$(stack_project "$v")" up -d "${build[@]}" >&2
  local url code=""
  url="$(stack_url "$v")/api/health"
  for _ in $(seq 1 90); do
    code="$(curl -sk -m 5 -o /dev/null -w '%{http_code}' "$url" || true)"
    [[ "$code" == "200" ]] && break
    sleep 2
  done
  [[ "$code" == "200" ]] || die "La app $v no respondió en $url"
  ok "SecureNotes $v disponible en $(stack_url "$v")"
}

stack_down() {
  docker compose -f "$(stack_compose "$1")" -p "$(stack_project "$1")" down -v >&2
}

# ---- CA adicional para entornos detrás de un proxy corporativo (opcional) ----
# Define EXTRA_CA_FILE=/ruta/al/ca.pem para que los escáneres en contenedor
# confíen en el certificado del proxy. Devuelve los argumentos de docker run.
extra_ca_docker_args() {
  [[ -n "${EXTRA_CA_FILE:-}" && -f "${EXTRA_CA_FILE}" ]] || return 0
  printf '%s\n' -v "${EXTRA_CA_FILE}:/etc/ssl/certs/extra-ca.pem:ro" \
    -e "SSL_CERT_FILE=/etc/ssl/certs/extra-ca.pem" \
    -e "NODE_EXTRA_CA_CERTS=/etc/ssl/certs/extra-ca.pem" \
    -e "REQUESTS_CA_BUNDLE=/etc/ssl/certs/extra-ca.pem" \
    -e "PIP_CERT=/etc/ssl/certs/extra-ca.pem"
}
