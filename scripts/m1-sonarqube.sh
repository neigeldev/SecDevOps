#!/usr/bin/env bash
# Módulo 1 · SAST con SonarQube Community Build
# Levanta SonarQube en Docker (http://localhost:9000), crea el token automáticamente,
# analiza la versión pedida y exporta el resumen de issues y security hotspots.
# Uso: ./scripts/m1-sonarqube.sh v1|v2
source "$(dirname "$0")/lib.sh"
check_version "${1:-}"
V="$1"
SRC="$(src_dir "$V")"
OUT="$(report_dir m1 "$V")"
need docker
need curl
need node

NET=securenotes-sonar
CONTAINER=securenotes-sonarqube
URL=http://localhost:9000
KEY="securenotes-$V"

docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker start "$CONTAINER" >/dev/null
  else
    log "Iniciando SonarQube ($SONARQUBE_IMAGE)"
    # SONAR_ES_BOOTSTRAP_CHECKS_DISABLE evita exigir vm.max_map_count en equipos de prueba
    docker run -d --name "$CONTAINER" --network "$NET" -p 127.0.0.1:9000:9000 \
      -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
      -v securenotes_sonarqube_data:/opt/sonarqube/data \
      "$SONARQUBE_IMAGE" >/dev/null
  fi
fi

log "Esperando a que SonarQube esté listo (1-3 min la primera vez)"
for _ in $(seq 1 120); do
  st="$(curl -s "$URL/api/system/status" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).status)}catch{console.log("")}})')"
  [[ "$st" == "UP" ]] && break
  sleep 5
done
[[ "$st" == "UP" ]] || die "SonarQube no respondió (docker logs $CONTAINER)"
ok "SonarQube UP en $URL"

# Contraseña de admin: se cambia la de fábrica (admin/admin) y se guarda en .secrets.env
save_secret() { touch "$ROOT/.secrets.env"; chmod 600 "$ROOT/.secrets.env"; sed -i.bak "/^$1=/d" "$ROOT/.secrets.env" && rm -f "$ROOT/.secrets.env.bak"; echo "$1=$2" >>"$ROOT/.secrets.env"; }
if [[ -z "${SONAR_ADMIN_PASSWORD:-}" ]]; then
  SONAR_ADMIN_PASSWORD="Sq-$(openssl rand -hex 12)"
  code="$(curl -s -o /dev/null -w '%{http_code}' -u admin:admin -X POST \
    "$URL/api/users/change_password" --data-urlencode "login=admin" \
    --data-urlencode "previousPassword=admin" --data-urlencode "password=$SONAR_ADMIN_PASSWORD")"
  [[ "$code" == "204" ]] || die "No se pudo cambiar la contraseña de admin (HTTP $code). Si ya la cambiaste, define SONAR_ADMIN_PASSWORD en .secrets.env"
  save_secret SONAR_ADMIN_PASSWORD "$SONAR_ADMIN_PASSWORD"
  ok "Contraseña de admin de SonarQube guardada en .secrets.env"
fi
AUTH=(-u "admin:$SONAR_ADMIN_PASSWORD")

if [[ -z "${SONAR_TOKEN:-}" ]]; then
  SONAR_TOKEN="$(curl -s "${AUTH[@]}" -X POST "$URL/api/user_tokens/generate" \
    --data-urlencode "name=securenotes-$(date +%s)" --data-urlencode "type=GLOBAL_ANALYSIS_TOKEN" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).token||""))')"
  [[ -n "$SONAR_TOKEN" ]] || die "No se pudo generar el token de análisis"
  save_secret SONAR_TOKEN "$SONAR_TOKEN"
fi

log "Analizando $V con sonar-scanner (proyecto $KEY)"
rm -rf "$OUT/.scannerwork"
docker run --rm --network "$NET" "${DOCKER_USER[@]}" \
  -e SONAR_HOST_URL="http://$CONTAINER:9000" -e SONAR_TOKEN \
  -v "$SRC/app:/usr/src:ro" -v "$OUT:/out" \
  "$SONAR_SCANNER_IMAGE" \
  -Dsonar.projectKey="$KEY" -Dsonar.projectName="SecureNotes $V" \
  -Dsonar.sources=src,views,public -Dsonar.exclusions="node_modules/**,test/**" \
  -Dsonar.working.directory=/out/.scannerwork -Dsonar.scm.disabled=true \
  -Dsonar.qualitygate.wait=false \
  >"$OUT/sonar-scanner.log" 2>&1 || die "Falló sonar-scanner (ver $OUT/sonar-scanner.log)"

TASK="$(sed -n 's/^ceTaskId=//p' "$OUT/.scannerwork/report-task.txt")"
log "Esperando el procesamiento del análisis ($TASK)"
for _ in $(seq 1 60); do
  st="$(curl -s "${AUTH[@]}" "$URL/api/ce/task?id=$TASK" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).task.status))')"
  [[ "$st" == "SUCCESS" || "$st" == "FAILED" || "$st" == "CANCELED" ]] && break
  sleep 3
done
[[ "$st" == "SUCCESS" ]] || die "El análisis terminó en estado $st"

curl -s "${AUTH[@]}" "$URL/api/issues/search?componentKeys=$KEY&ps=500&facets=impactSoftwareQualities,impactSeverities,types,severities" >"$OUT/sonarqube-issues.json"
curl -s "${AUTH[@]}" "$URL/api/hotspots/search?project=$KEY&ps=500" >"$OUT/sonarqube-hotspots.json"
curl -s "${AUTH[@]}" "$URL/api/measures/component?component=$KEY&metricKeys=ncloc,security_rating,reliability_rating,sqale_rating,security_hotspots,vulnerabilities,bugs,code_smells" >"$OUT/sonarqube-measures.json"
curl -s "${AUTH[@]}" "$URL/api/qualitygates/project_status?projectKey=$KEY" >"$OUT/sonarqube-qualitygate.json"

node - "$OUT" <<'JS'
const fs = require('fs');
const out = process.argv[2];
const read = (f) => JSON.parse(fs.readFileSync(`${out}/${f}`, 'utf8'));
const issues = read('sonarqube-issues.json');
const hotspots = read('sonarqube-hotspots.json');
const measures = (read('sonarqube-measures.json').component || {}).measures || [];
const gate = (read('sonarqube-qualitygate.json').projectStatus || {}).status;
const facet = (name) => Object.fromEntries(((issues.facets || []).find((f) => f.property === name) || { values: [] }).values.map((v) => [v.val, v.count]));
const summary = {
  issues_total: issues.total ?? (issues.issues || []).length,
  by_software_quality: facet('impactSoftwareQualities'),
  by_impact_severity: facet('impactSeverities'),
  security_hotspots: hotspots.paging ? hotspots.paging.total : (hotspots.hotspots || []).length,
  hotspots_by_probability: (hotspots.hotspots || []).reduce((a, h) => ((a[h.vulnerabilityProbability] = (a[h.vulnerabilityProbability] || 0) + 1), a), {}),
  measures: Object.fromEntries(measures.map((m) => [m.metric, m.value])),
  quality_gate: gate
};
fs.writeFileSync(`${out}/sonarqube-summary.json`, JSON.stringify(summary, null, 2));
console.log('  SonarQube:', JSON.stringify(summary));
JS
ok "Panel: $URL/dashboard?id=$KEY (usuario admin, contraseña en .secrets.env) · Reportes en $OUT/sonarqube-*.json"
