#!/usr/bin/env bash
# Módulo 2 · Verificación de la configuración en ejecución de los contenedores
# Levanta la versión indicada y documenta usuario, sistema de archivos, capacidades,
# puertos publicados, redes y secretos en variables de entorno.
# Uso: ./scripts/m2-runtime-check.sh v1|v2
source "$(dirname "$0")/lib.sh"
check_version "${1:-}"
V="$1"
OUT="$(report_dir m2 "$V")"
need docker

stack_up "$V"
PROJECT="$(stack_project "$V")"
ids="$(docker compose -f "$(stack_compose "$V")" -p "$PROJECT" ps -q)"

{
  echo "# Configuración en ejecución · SecureNotes $V"
  echo
  echo "| Servicio | Usuario | FS solo lectura | Capacidades eliminadas | Capacidades añadidas | Privilegiado | no-new-privileges | Puertos publicados | Límite memoria | Variables con secretos |"
  echo "|---|---|---|---|---|---|---|---|---|---|"
  for id in $ids; do
    docker inspect "$id" | node -e '
let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const c = JSON.parse(s)[0], h = c.HostConfig, cfg = c.Config;
  const svc = cfg.Labels["com.docker.compose.service"];
  const ports = Object.entries(h.PortBindings || {}).map(([p, b]) => b.map((x) => `${x.HostIp || "0.0.0.0"}:${x.HostPort}->${p}`).join(" ")).join(" ") || "ninguno";
  const secrets = (cfg.Env || []).filter((e) => /(PASSWORD|SECRET|TOKEN)=/i.test(e) && !/_FILE=/.test(e)).map((e) => e.split("=")[0]).join(", ") || "ninguna";
  const nnp = (h.SecurityOpt || []).some((o) => o.startsWith("no-new-privileges")) ? "sí" : "no";
  const mem = h.Memory ? `${Math.round(h.Memory / 1048576)} MiB` : "sin límite";
  console.log(`| ${svc} | ${cfg.User || "root"} | ${h.ReadonlyRootfs ? "sí" : "no"} | ${(h.CapDrop || []).join(",") || "ninguna"} | ${(h.CapAdd || []).join(",") || "ninguna"} | ${h.Privileged ? "sí" : "no"} | ${nnp} | ${ports} | ${mem} | ${secrets} |`);
});'
  done
  echo
  echo "## Redes"
  echo
  for n in $(docker network ls --filter "label=com.docker.compose.project=$PROJECT" --format '{{.Name}}'); do
    echo "- \`$n\`: internal=$(docker network inspect "$n" --format '{{.Internal}}')"
  done
} >"$OUT/runtime-config.md"

cat "$OUT/runtime-config.md" >&2
ok "Reporte: $OUT/runtime-config.md"
[[ "${KEEP_STACK:-0}" == "1" ]] || stack_down "$V"
