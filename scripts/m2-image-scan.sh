#!/usr/bin/env bash
# Módulo 2 · Escaneo de la imagen de contenedor con Trivy (+ SBOM CycloneDX)
# Uso: ./scripts/m2-image-scan.sh v1|v2
source "$(dirname "$0")/lib.sh"
check_version "${1:-}"
V="$1"
SRC="$(src_dir "$V")"
OUT="$(report_dir m2 "$V")"
IMAGE="securenotes:$V"
need docker
mkdir -p "$CACHE/trivy"

if [[ "${NO_BUILD:-0}" != "1" ]]; then
  log "Construyendo la imagen $IMAGE"
  docker build -t "$IMAGE" "$SRC/app" >"$OUT/docker-build.log" 2>&1 || die "Falló el build (ver $OUT/docker-build.log)"
fi

mapfile -t CA_ARGS < <(extra_ca_docker_args)
TRIVY=(docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$CACHE/trivy:/root/.cache/trivy" -v "$OUT:/out" "${CA_ARGS[@]}" "$TRIVY_IMAGE")

log "Trivy image sobre $IMAGE"
"${TRIVY[@]}" image --quiet --scanners vuln,secret --format json --output /out/trivy-image.json "$IMAGE" >"$OUT/trivy-image.log" 2>&1 || warn "Trivy image falló (ver $OUT/trivy-image.log)"
"${TRIVY[@]}" image --quiet --scanners vuln,secret --severity HIGH,CRITICAL --format table --output /out/trivy-image.txt "$IMAGE" >>"$OUT/trivy-image.log" 2>&1 || true
"${TRIVY[@]}" image --quiet --format cyclonedx --output /out/sbom-cyclonedx.json "$IMAGE" >>"$OUT/trivy-image.log" 2>&1 || true

# Metadatos de seguridad de la imagen
docker image inspect "$IMAGE" --format '{{json .}}' | node -e '
let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const i = JSON.parse(s), c = i.Config || {};
  const info = {
    image: process.argv[1],
    size_mb: Math.round(i.Size / 1e6),
    user: c.User || "root (por defecto)",
    healthcheck: Boolean(c.Healthcheck),
    entrypoint: c.Entrypoint, cmd: c.Cmd,
    env_with_secrets: (c.Env || []).filter((e) => /(SECRET|PASSWORD|TOKEN)=/i.test(e)).map((e) => e.split("=")[0]),
    layers: (i.RootFS && i.RootFS.Layers || []).length
  };
  require("fs").writeFileSync(process.argv[2], JSON.stringify(info, null, 2));
  console.log("  Imagen:", JSON.stringify(info));
});' "$IMAGE" "$OUT/image-inspect.json"

node -e '
const r = require(process.argv[1]);
const by = {}; let secrets = 0;
for (const x of r.Results || []) {
  for (const v of x.Vulnerabilities || []) by[v.Severity] = (by[v.Severity] || 0) + 1;
  secrets += (x.Secrets || []).length;
}
console.log("  Trivy vulnerabilidades:", JSON.stringify(by), "· secretos en la imagen:", secrets);
' "$OUT/trivy-image.json" 2>/dev/null || true
ok "Reportes: $OUT/trivy-image.{json,txt}, $OUT/sbom-cyclonedx.json, $OUT/image-inspect.json"
