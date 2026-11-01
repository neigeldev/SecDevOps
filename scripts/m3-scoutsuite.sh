#!/usr/bin/env bash
# Módulo 3 · CSPM con ScoutSuite (segunda herramienta, para contrastar con Prowler)
# No hay imagen oficial estable, así que se instala en un contenedor Python efímero.
# Uso: ./scripts/m3-scoutsuite.sh [before|after]
source "$(dirname "$0")/lib.sh"
STAGE="${1:-after}"
OUT="$(report_dir m3 "scoutsuite-$STAGE")"
need docker
need aws

# shellcheck disable=SC2034
ENVARGS=$(aws_env_args)
assume_audit_role_if_present

log "ScoutSuite ($STAGE) sobre la cuenta AWS (instala la herramienta y escanea; 5-15 min)"
docker run --rm \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN \
  -e AWS_DEFAULT_REGION="$AWS_REGION" \
  -e PIP_ROOT_USER_ACTION=ignore \
  -v "$OUT:/report" -w /report \
  "$PYTHON_IMAGE" bash -c "
    set -e
    pip install --quiet --no-input 'ScoutSuite==$SCOUTSUITE_VERSION'
    scout aws --no-browser --force \
      --report-dir /report --report-name securenotes-$STAGE \
      --regions $AWS_REGION
  " >"$OUT/scoutsuite.log" 2>&1 || warn "ScoutSuite terminó con código $? (ver $OUT/scoutsuite.log)"

# ScoutSuite deja el resultado en report/scoutsuite-results/scoutsuite_results_*.js (JS con un prefijo)
RES="$(ls "$OUT"/scoutsuite-results/scoutsuite_results_*.js 2>/dev/null | head -1 || true)"
if [[ -n "$RES" ]]; then
  node - "$RES" "$OUT" "$STAGE" <<'JS'
const fs = require('fs');
const [res, out, stage] = process.argv.slice(2);
const raw = fs.readFileSync(res, 'utf8').replace(/^[^=]*=\s*/, '');
const data = JSON.parse(raw);
const sev = { danger: 0, warning: 0 };
let flagged = 0;
for (const svc of Object.values(data.services || {})) {
  for (const f of Object.values(svc.findings || {})) {
    if (!f.flagged_items) continue;
    flagged += f.flagged_items;
    if (f.level === 'danger') sev.danger += 1;
    else if (f.level === 'warning') sev.warning += 1;
  }
}
const summary = { stage, rules_danger: sev.danger, rules_warning: sev.warning, flagged_items: flagged };
fs.writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2));
console.log('  ScoutSuite:', JSON.stringify(summary));
JS
else
  warn "No se encontró el archivo de resultados de ScoutSuite"
fi
ok "Informe HTML: $OUT/securenotes-$STAGE.html"
