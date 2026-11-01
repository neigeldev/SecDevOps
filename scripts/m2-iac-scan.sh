#!/usr/bin/env bash
# Módulo 2 · Escaneo de configuración de la infraestructura como código
#   - Checkov: Terraform + Dockerfile (políticas como código)
#   - Trivy config: Terraform + Dockerfile
#   - Hadolint: buenas prácticas del Dockerfile
# Uso: ./scripts/m2-iac-scan.sh v1|v2
source "$(dirname "$0")/lib.sh"
check_version "${1:-}"
V="$1"
SRC="$(src_dir "$V")"
OUT="$(report_dir m2 "$V")"
need docker
mkdir -p "$CACHE/trivy"

log "Checkov sobre la IaC de $V"
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$SRC:/src:ro" -v "$OUT:/out" "$CHECKOV_IMAGE" \
  -d /src/infra/terraform -d /src/app --framework terraform dockerfile \
  --skip-download --compact \
  -o cli -o json --output-file-path /out/checkov.txt,/out/checkov.json \
  >"$OUT/checkov.log" 2>&1 || true

log "Trivy config sobre la IaC de $V"
trivy_config() {
  docker run --rm -v "$SRC:/src:ro" -v "$OUT:/out" -v "$CACHE/trivy:/root/.cache/trivy" "$TRIVY_IMAGE" \
    config --quiet --skip-dirs "**/node_modules" --skip-dirs ".worktrees" --skip-dirs "reports" "$@" /src
}
trivy_config --format json --output /out/trivy-config.json >"$OUT/trivy-config.log" 2>&1 \
  || warn "Trivy config falló (ver $OUT/trivy-config.log)"
trivy_config --format table --output /out/trivy-config.txt >>"$OUT/trivy-config.log" 2>&1 || true

log "Hadolint sobre app/Dockerfile de $V"
docker run --rm -i "$HADOLINT_IMAGE" hadolint --format json - <"$SRC/app/Dockerfile" >"$OUT/hadolint.json" 2>/dev/null || true
docker run --rm -i "$HADOLINT_IMAGE" hadolint - <"$SRC/app/Dockerfile" >"$OUT/hadolint.txt" 2>&1 || true

node - "$OUT" <<'JS'
const fs = require('fs');
const out = process.argv[2];
const tryRead = (f) => { try { return JSON.parse(fs.readFileSync(`${out}/${f}`, 'utf8')); } catch { return null; } };
const ck = tryRead('checkov.json');
const ckList = Array.isArray(ck) ? ck : ck ? [ck] : [];
const ckSum = ckList.reduce((a, r) => { const s = r.summary || {}; a.passed += s.passed || 0; a.failed += s.failed || 0; a.skipped += s.skipped || 0; return a; }, { passed: 0, failed: 0, skipped: 0 });
console.log('  Checkov:', JSON.stringify(ckSum));
const tv = tryRead('trivy-config.json');
const tvBy = {};
for (const r of (tv && tv.Results) || []) for (const m of r.Misconfigurations || []) if (m.Status === 'FAIL') tvBy[m.Severity] = (tvBy[m.Severity] || 0) + 1;
console.log('  Trivy config (fallos por severidad):', JSON.stringify(tvBy));
const hd = tryRead('hadolint.json') || [];
const hdBy = hd.reduce((a, x) => ((a[x.level] = (a[x.level] || 0) + 1), a), {});
console.log('  Hadolint:', JSON.stringify(hdBy));
JS
ok "Reportes: $OUT/{checkov,trivy-config,hadolint}.*"
