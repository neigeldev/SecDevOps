# Evidencias de escaneo

Esta carpeta guarda los reportes que generan los scripts de `scripts/`. Se versiona
para que las evidencias queden junto al código, pero **puedes regenerarla** en
cualquier momento.

```
reports/
  m1/{v1,v2}/   SAST, SCA y DAST del código (Semgrep, npm audit, Dependency-Check, SonarQube, ZAP)
  m2/{v1,v2}/   IaC y contenedores (Checkov, Trivy, Hadolint) + runtime-config
  m3/prowler-*  CSPM Prowler (before/after)
  m3/scoutsuite-* CSPM ScoutSuite (before/after)
  RESULTADOS.md tabla consolidada antes/después (node scripts/summarize.mjs)
  summary.json  los mismos datos en JSON
```

Las capturas de pantalla para el informe van en `docs/anexos/img/`.
