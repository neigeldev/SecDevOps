# Resultados consolidados — SecureNotes (antes / después)

_Generado el 2026-11-02T02:12:55.923Z a partir de los reportes en `reports/`._

> Las celdas con «—» indican que ese escaneo aún no se ha ejecutado en este equipo.
> Reconstruye esta tabla en cualquier momento con `node scripts/summarize.mjs`.

## Módulo 1 — Seguridad en el código

| Herramienta | Métrica | v1 (vulnerable) | v2 (segura) |
|---|---|--:|--:|
| Semgrep (SAST) | Hallazgos totales | 19 | 0 |
| Semgrep | ERROR | 14 | 0 |
| npm audit (SCA) | Total (crit/high) | 16 (2/6) | 0 (0/0) |
| OWASP Dependency-Check (SCA) | CVE únicos | 33 | 1 |
| SonarQube | Issues | 2 | 0 |
| SonarQube | Security hotspots | 0 | 0 |
| OWASP ZAP (DAST) | Alto / Medio / Bajo | A:0 M:3 B:7 | A:0 M:0 B:1 |

## Módulo 2 — Infraestructura como código y contenedores

| Herramienta | Métrica | v1 (vulnerable) | v2 (segura) |
|---|---|--:|--:|
| Checkov (IaC) | Controles fallidos | 31 | 0 |
| Checkov (IaC) | Controles superados | 50 | 443 |
| Trivy (imagen) | CRITICAL | 19 | 0 |
| Trivy (imagen) | HIGH | 406 | 0 |
| Trivy (imagen) | MEDIUM / LOW | 538/117 | 24/8 |
| Imagen | Tamaño (MB) | 1360 | 223 |
| Imagen | Usuario | root (por defecto) | 65532:65532 |
| Imagen | Secretos en ENV | JWT_SECRET, DB_PASSWORD | ninguno |

## Módulo 3 — Seguridad en la nube (CSPM)

| Herramienta | Métrica | Antes (línea base) | Después |
|---|---|--:|--:|
| Prowler | Controles FAIL | — | 95 |
| Prowler | Controles PASS | — | 352 |
| ScoutSuite | Reglas en peligro | — | 6 |
| ScoutSuite | Ítems marcados | — | 47 |
