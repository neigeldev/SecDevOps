#!/usr/bin/env bash
# Módulo 1 · SCA (análisis de componentes de terceros)
#   - OWASP Dependency-Check (requiere NVD_API_KEY en .secrets.env o en el entorno)
#   - npm audit (complemento rápido, base de datos de GitHub Advisories)
# Uso: ./scripts/m1-sca.sh v1|v2
source "$(dirname "$0")/lib.sh"
check_version "${1:-}"
V="$1"
SRC="$(src_dir "$V")"
OUT="$(report_dir m1 "$V")"
need docker

# ---------- npm audit ----------
log "npm audit sobre $V"
need npm
(cd "$SRC/app" && npm audit --package-lock-only --json >"$OUT/npm-audit.json" 2>/dev/null) || true
node -e '
const m = require(process.argv[1]).metadata || {};
console.log("  npm audit:", JSON.stringify(m.vulnerabilities || {}));
' "$OUT/npm-audit.json" 2>/dev/null || warn "No se pudo leer npm-audit.json"

# ---------- OWASP Dependency-Check ----------
if [[ -z "${NVD_API_KEY:-}" ]]; then
  warn "NVD_API_KEY no definida: se omite Dependency-Check."
  warn "Crea .secrets.env con NVD_API_KEY=<tu clave> (https://nvd.nist.gov/developers/request-an-api-key)."
  exit 0
fi

mkdir -p "$CACHE/dependency-check"
log "OWASP Dependency-Check sobre $V (la primera vez descarga la base NVD: 10-30 min)"
docker run --rm --user "$(id -u):$(id -g)" \
  -e NVD_API_KEY \
  -v "$SRC/app:/src:ro" \
  -v "$CACHE/dependency-check:/usr/share/dependency-check/data" \
  -v "$OUT:/report" \
  "$DEPCHECK_IMAGE" \
  --scan /src \
  --exclude "**/node_modules/**" --exclude "**/test/**" \
  --project "SecureNotes $V" \
  --nvdApiKey "$NVD_API_KEY" \
  --disableOssIndex --disableYarnAudit --disablePnpmAudit \
  --format HTML --format JSON --format SARIF \
  --out /report \
  >"$OUT/dependency-check.log" 2>&1 || warn "Dependency-Check terminó con código $? (ver $OUT/dependency-check.log)"

node -e '
const r = require(process.argv[1]);
const seen = new Map();
for (const d of r.dependencies || []) for (const v of d.vulnerabilities || []) seen.set(v.name, (v.severity || "UNKNOWN").toUpperCase());
const by = {};
for (const s of seen.values()) by[s] = (by[s] || 0) + 1;
console.log(`  Dependency-Check: ${seen.size} vulnerabilidades únicas`, JSON.stringify(by));
' "$OUT/dependency-check-report.json" 2>/dev/null || warn "No se generó dependency-check-report.json"
ok "Reportes: $OUT/npm-audit.json, $OUT/dependency-check-report.{html,json,sarif}"
