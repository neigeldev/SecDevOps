#!/usr/bin/env bash
# Módulo 3 · CSPM con Prowler (postura de seguridad de la cuenta AWS)
# Uso: ./scripts/m3-prowler.sh [before|after]
#   La etiqueta (before/after) solo nombra la carpeta de evidencias para comparar
#   antes y después de aplicar la línea base.
#   SUMMARY_ONLY=1 -> no vuelve a escanear; solo resume el reporte ya generado.
source "$(dirname "$0")/lib.sh"
STAGE="${1:-after}"
OUT="$(report_dir m3 "prowler-$STAGE")"
need docker
need aws

# shellcheck disable=SC2046
ENVARGS=$(aws_env_args)
assume_audit_role_if_present
# Reexportar por si assume_audit_role_if_present rotó las credenciales
mapfile -t ENVARR < <(printf '%s\n' $ENVARGS)

if [[ "${SUMMARY_ONLY:-0}" == "1" ]]; then
  log "SUMMARY_ONLY=1: se reutiliza el reporte existente de Prowler ($STAGE)"
else
  log "Prowler ($STAGE) sobre la cuenta AWS en $AWS_REGION (tarda 5-15 min)"
  rc=0
  docker run --rm \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN \
    -e AWS_DEFAULT_REGION="$AWS_REGION" -e AWS_REGION="$AWS_REGION" \
    -v "$OUT:/output" \
    "$PROWLER_IMAGE" aws \
    --region "$AWS_REGION" \
    --output-formats json-ocsf csv html \
    --output-directory /output --output-filename "prowler-$STAGE" \
    >"$OUT/prowler.log" 2>&1 || rc=$?
  # Prowler devuelve 3 cuando terminó bien pero hay controles en FAIL (lo esperable)
  if [[ "$rc" == 3 ]]; then
    ok "Prowler terminó: hay controles en FAIL (código 3, es lo normal)"
  elif [[ "$rc" != 0 ]]; then
    warn "Prowler terminó con código $rc (ver $OUT/prowler.log)"
  fi
fi

node - "$OUT" "$STAGE" <<'JS'
const fs = require('fs');
const [out, stage] = process.argv.slice(2);
const f = `${out}/prowler-${stage}.ocsf.json`;
// Sin "return" de nivel superior: Node 24 lo rechaza al leer el script por stdin
if (!fs.existsSync(f)) {
  console.log('  (sin JSON OCSF; revisa prowler.log)');
  process.exit(0);
}
const data = JSON.parse(fs.readFileSync(f, 'utf8'));
let pass = 0, fail = 0; const sev = {};
for (const r of data) {
  const status = (r.status_code || (r.status_detail && r.status) || '').toUpperCase();
  const s = (r.finding_info && r.severity) || r.severity || 'Unknown';
  if (status === 'PASS') pass++;
  else if (status === 'FAIL') { fail++; sev[s] = (sev[s] || 0) + 1; }
}
const summary = { stage, pass, fail, fail_by_severity: sev };
fs.writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2));
console.log('  Prowler:', JSON.stringify(summary));
JS
ok "Reportes en $OUT (html, csv, ocsf.json)"
