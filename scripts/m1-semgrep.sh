#!/usr/bin/env bash
# Módulo 1 · SAST con Semgrep
# Uso: ./scripts/m1-semgrep.sh v1|v2
#   SEMGREP_OFFLINE=1 -> solo reglas locales (security/semgrep), sin descargar del registro
source "$(dirname "$0")/lib.sh"
check_version "${1:-}"
V="$1"
SRC="$(src_dir "$V")"
OUT="$(report_dir m1 "$V")"
need docker

CONFIGS=(--config /rules)
if [[ "${SEMGREP_OFFLINE:-0}" != "1" ]]; then
  CONFIGS+=(--config p/owasp-top-ten --config p/javascript --config p/nodejs --config p/expressjs --config p/secrets)
fi

log "Semgrep sobre $V ($SRC/app)"
docker run --rm "${DOCKER_USER[@]}" -e HOME=/tmp -e SEMGREP_ENABLE_VERSION_CHECK=0 -e SEMGREP_SEND_METRICS=off \
  -v "$SRC/app:/src:ro" -v "$ROOT/security/semgrep:/rules:ro" -v "$OUT:/out" \
  "$SEMGREP_IMAGE" semgrep scan "${CONFIGS[@]}" --metrics=off \
  --exclude node_modules --exclude test \
  --json-output=/out/semgrep.json --sarif-output=/out/semgrep.sarif --text-output=/out/semgrep.txt \
  /src >/dev/null 2>"$OUT/semgrep.log" || warn "Semgrep terminó con código $? (ver $OUT/semgrep.log)"

node -e '
const r = require(process.argv[1]).results || [];
const by = {};
r.forEach((x) => { const s = x.extra.severity; by[s] = (by[s] || 0) + 1; });
console.log(`  Hallazgos: ${r.length}`, JSON.stringify(by));
' "$OUT/semgrep.json" 2>/dev/null || true
ok "Reportes: $OUT/semgrep.{json,sarif,txt}"
