#!/usr/bin/env node
// Consolida los reportes de reports/ en una tabla antes/después (Markdown + JSON).
// Uso: node scripts/summarize.mjs   (o ./scripts/summarize.sh)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath convierte bien file:///C:/... en Windows (pathname daba C:\\C:\\...)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = path.join(ROOT, 'reports');
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const exists = (p) => fs.existsSync(p);
const num = (n) => (n === undefined || n === null ? '—' : n);

function semgrep(v) {
  const r = read(`${R}/m1/${v}/semgrep.json`);
  if (!r) return null;
  const by = {};
  for (const x of r.results || []) { const s = x.extra.severity; by[s] = (by[s] || 0) + 1; }
  return { total: (r.results || []).length, ...by };
}
function npmAudit(v) {
  const r = read(`${R}/m1/${v}/npm-audit.json`);
  const m = r && r.metadata && r.metadata.vulnerabilities;
  return m ? { total: m.total, critical: m.critical, high: m.high, moderate: m.moderate, low: m.low } : null;
}
function depCheck(v) {
  const r = read(`${R}/m1/${v}/dependency-check-report.json`);
  if (!r) return null;
  const seen = new Map();
  for (const d of r.dependencies || []) for (const vu of d.vulnerabilities || []) seen.set(vu.name, (vu.severity || 'UNKNOWN').toUpperCase());
  const by = {};
  for (const s of seen.values()) by[s] = (by[s] || 0) + 1;
  return { total: seen.size, ...by };
}
function sonar(v) {
  return read(`${R}/m1/${v}/sonarqube-summary.json`);
}
function zap(v, mode = 'baseline') {
  const r = read(`${R}/m1/${v}/zap-${mode}.json`);
  if (!r) return null;
  const names = ['info', 'low', 'medium', 'high'];
  const by = { high: 0, medium: 0, low: 0, info: 0 };
  for (const site of r.site || []) for (const a of site.alerts || []) by[names[Number(a.riskcode)] || 'info']++;
  return by;
}
function checkov(v, mod) {
  const r = read(`${R}/${mod}/${v}/checkov.json`);
  if (!r) return null;
  const list = Array.isArray(r) ? r : [r];
  return list.reduce((a, x) => { const s = x.summary || {}; a.passed += s.passed || 0; a.failed += s.failed || 0; a.skipped += s.skipped || 0; return a; }, { passed: 0, failed: 0, skipped: 0 });
}
function trivyImage(v) {
  const r = read(`${R}/m2/${v}/trivy-image.json`);
  if (!r) return null;
  const by = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let secrets = 0;
  for (const x of r.Results || []) { for (const vu of x.Vulnerabilities || []) by[vu.Severity] = (by[vu.Severity] || 0) + 1; secrets += (x.Secrets || []).length; }
  return { ...by, secrets };
}
function imageInfo(v) { return read(`${R}/m2/${v}/image-inspect.json`); }
function cspm(tool, stage) {
  return read(`${R}/m3/${tool}-${stage}/summary.json`);
}

const data = {
  generated: new Date().toISOString(),
  m1: {
    semgrep: { v1: semgrep('v1'), v2: semgrep('v2') },
    npm_audit: { v1: npmAudit('v1'), v2: npmAudit('v2') },
    dependency_check: { v1: depCheck('v1'), v2: depCheck('v2') },
    sonarqube: { v1: sonar('v1'), v2: sonar('v2') },
    zap: { v1: zap('v1', 'full') || zap('v1', 'baseline'), v2: zap('v2', 'full') || zap('v2', 'baseline') }
  },
  m2: {
    checkov: { v1: checkov('v1', 'm2'), v2: checkov('v2', 'm2') },
    trivy_image: { v1: trivyImage('v1'), v2: trivyImage('v2') },
    image: { v1: imageInfo('v1'), v2: imageInfo('v2') }
  },
  m3: {
    prowler: { before: cspm('prowler', 'before'), after: cspm('prowler', 'after') },
    scoutsuite: { before: cspm('scoutsuite', 'before'), after: cspm('scoutsuite', 'after') }
  }
};

fs.writeFileSync(`${R}/summary.json`, JSON.stringify(data, null, 2));

const L = [];
L.push('# Resultados consolidados — SecureNotes (antes / después)');
L.push('');
L.push(`_Generado el ${data.generated} a partir de los reportes en \`reports/\`._`);
L.push('');
L.push('> Las celdas con «—» indican que ese escaneo aún no se ha ejecutado en este equipo.');
L.push('> Reconstruye esta tabla en cualquier momento con `node scripts/summarize.mjs`.');
L.push('');

L.push('## Módulo 1 — Seguridad en el código');
L.push('');
L.push('| Herramienta | Métrica | v1 (vulnerable) | v2 (segura) |');
L.push('|---|---|--:|--:|');
const sg = data.m1.semgrep;
L.push(`| Semgrep (SAST) | Hallazgos totales | ${num(sg.v1?.total)} | ${num(sg.v2?.total)} |`);
L.push(`| Semgrep | ERROR | ${num(sg.v1?.ERROR)} | ${num(sg.v2?.ERROR ?? (sg.v2 ? 0 : undefined))} |`);
const na = data.m1.npm_audit;
L.push(`| npm audit (SCA) | Total (crit/high) | ${na.v1 ? `${na.v1.total} (${na.v1.critical}/${na.v1.high})` : '—'} | ${na.v2 ? `${na.v2.total} (${na.v2.critical}/${na.v2.high})` : '—'} |`);
const dc = data.m1.dependency_check;
L.push(`| OWASP Dependency-Check (SCA) | CVE únicos | ${num(dc.v1?.total)} | ${num(dc.v2?.total)} |`);
const so = data.m1.sonarqube;
L.push(`| SonarQube | Issues | ${num(so.v1?.issues_total)} | ${num(so.v2?.issues_total)} |`);
L.push(`| SonarQube | Security hotspots | ${num(so.v1?.security_hotspots)} | ${num(so.v2?.security_hotspots)} |`);
const zp = data.m1.zap;
const zf = (z) => (z ? `A:${z.high} M:${z.medium} B:${z.low}` : '—');
L.push(`| OWASP ZAP (DAST) | Alto / Medio / Bajo | ${zf(zp.v1)} | ${zf(zp.v2)} |`);
L.push('');

L.push('## Módulo 2 — Infraestructura como código y contenedores');
L.push('');
L.push('| Herramienta | Métrica | v1 (vulnerable) | v2 (segura) |');
L.push('|---|---|--:|--:|');
const ck = data.m2.checkov;
L.push(`| Checkov (IaC) | Controles fallidos | ${num(ck.v1?.failed)} | ${num(ck.v2?.failed)} |`);
L.push(`| Checkov (IaC) | Controles superados | ${num(ck.v1?.passed)} | ${num(ck.v2?.passed)} |`);
const ti = data.m2.trivy_image;
L.push(`| Trivy (imagen) | CRITICAL | ${num(ti.v1?.CRITICAL)} | ${num(ti.v2?.CRITICAL)} |`);
L.push(`| Trivy (imagen) | HIGH | ${num(ti.v1?.HIGH)} | ${num(ti.v2?.HIGH)} |`);
L.push(`| Trivy (imagen) | MEDIUM / LOW | ${ti.v1 ? `${ti.v1.MEDIUM}/${ti.v1.LOW}` : '—'} | ${ti.v2 ? `${ti.v2.MEDIUM}/${ti.v2.LOW}` : '—'} |`);
const im = data.m2.image;
L.push(`| Imagen | Tamaño (MB) | ${num(im.v1?.size_mb)} | ${num(im.v2?.size_mb)} |`);
L.push(`| Imagen | Usuario | ${im.v1?.user ?? '—'} | ${im.v2?.user ?? '—'} |`);
L.push(`| Imagen | Secretos en ENV | ${im.v1 ? (im.v1.env_with_secrets.join(', ') || 'ninguno') : '—'} | ${im.v2 ? (im.v2.env_with_secrets.join(', ') || 'ninguno') : '—'} |`);
L.push('');

L.push('## Módulo 3 — Seguridad en la nube (CSPM)');
L.push('');
L.push('| Herramienta | Métrica | Antes (línea base) | Después |');
L.push('|---|---|--:|--:|');
const pw = data.m3.prowler;
L.push(`| Prowler | Controles FAIL | ${num(pw.before?.fail)} | ${num(pw.after?.fail)} |`);
L.push(`| Prowler | Controles PASS | ${num(pw.before?.pass)} | ${num(pw.after?.pass)} |`);
const ss = data.m3.scoutsuite;
L.push(`| ScoutSuite | Reglas en peligro | ${num(ss.before?.rules_danger)} | ${num(ss.after?.rules_danger)} |`);
L.push(`| ScoutSuite | Ítems marcados | ${num(ss.before?.flagged_items)} | ${num(ss.after?.flagged_items)} |`);
L.push('');

fs.writeFileSync(`${R}/RESULTADOS.md`, L.join('\n'));
console.log(L.join('\n'));
console.error(`\nEscrito: ${R}/RESULTADOS.md y ${R}/summary.json`);
