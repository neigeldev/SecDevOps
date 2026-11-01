#!/usr/bin/env bash
# Genera los secretos locales para docker-compose (v2) en infra/docker/secrets/.
# La carpeta está en .gitignore: los secretos nunca se suben al repositorio.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/infra/docker/secrets"
mkdir -p "$DIR"
chmod 700 "$DIR"

gen() { # gen <archivo> <bytes>
  local f="$DIR/$1"
  if [[ -s "$f" ]]; then
    echo "  = $1 (ya existe, se conserva)"
  else
    openssl rand -base64 "$2" | tr -d '\n/+=' > "$f"
    echo "  + $1"
  fi
  # 0644: los contenedores usan usuarios sin privilegios (uid 70 y 65532) que deben
  # poder leer el archivo montado; la carpeta (0700) impide el acceso a otros usuarios del host.
  chmod 644 "$f"
}

echo "Generando secretos en $DIR"
gen db_password.txt 24
gen jwt_secret.txt 48
gen admin_password.txt 18
echo "Usuario administrador: admin / $(cat "$DIR/admin_password.txt")"
