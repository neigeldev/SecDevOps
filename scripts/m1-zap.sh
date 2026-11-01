#!/usr/bin/env bash
# Módulo 1 · DAST con OWASP ZAP contra la app en ejecución (docker compose)
# Uso: ./scripts/m1-zap.sh v1|v2 [baseline|full]
#   baseline: escaneo pasivo (rápido, ~2-5 min)
#   full:     escaneo activo con ataques (SQLi, XSS, inyección...) ~10-30 min.
#             Solo contra tu entorno local: nunca contra sistemas de terceros.
source "$(dirname "$0")/lib.sh"
check_version "${1:-}"
V="$1"
MODE="${2:-baseline}"
[[ "$MODE" == "baseline" || "$MODE" == "full" ]] || die "Modo inválido: usa baseline o full"
OUT="$(report_dir m1 "$V")"
need docker
need curl

# En el escaneo completo se amplía el límite de tasa de la v2 para que ZAP pruebe
# el código y no solo el limitador (equivale a poner el escáner en lista blanca).
if [[ "$MODE" == "full" ]]; then
  export RATE_LIMIT_PER_MIN=100000 LOGIN_RATE_LIMIT=100000
fi
stack_up "$V"

chmod 777 "$OUT"
if [[ "$MODE" == "baseline" ]]; then
  SCRIPT=zap-baseline.py
  EXTRA=(-m 2)
else
  SCRIPT=zap-full-scan.py
  EXTRA=(-m 3 -T 30)
fi

log "ZAP $MODE contra $V ($(stack_target "$V"))"
docker run --rm --network "$(stack_network "$V")" -v "$OUT:/zap/wrk:rw" "$ZAP_IMAGE" \
  "$SCRIPT" -t "$(stack_target "$V")" \
  -r "zap-$MODE.html" -J "zap-$MODE.json" -w "zap-$MODE.md" -I "${EXTRA[@]}" \
  >"$OUT/zap-$MODE.log" 2>&1 || warn "ZAP terminó con código $? (ver $OUT/zap-$MODE.log)"

node -e '
const r = require(process.argv[1]);
const names = ["Informativo", "Bajo", "Medio", "Alto"];
const by = {};
let instances = 0;
for (const site of r.site || []) for (const a of site.alerts || []) {
  const k = names[Number(a.riskcode)] || a.riskcode;
  by[k] = (by[k] || 0) + 1;
  instances += Number(a.count || (a.instances || []).length || 0);
}
console.log("  ZAP alertas por riesgo:", JSON.stringify(by), "· instancias:", instances);
' "$OUT/zap-$MODE.json" 2>/dev/null || warn "No se generó zap-$MODE.json"
ok "Reportes: $OUT/zap-$MODE.{html,json,md}"
[[ "${KEEP_STACK:-0}" == "1" ]] || stack_down "$V"
