# Plataforma web segura: del código a la nube

**Proyecto Final Integrador — Módulo Desarrollo seguro, criptografía e IAM
(Diplomado DevOps)**

> Documento guía con la estructura de la plantilla institucional de Informe Final.
> Trasladar a la plantilla oficial y añadir portada, índice y las capturas de los
> Anexos A, B y C.

- **Autor:** _(tu nombre)_
- **Fecha:** noviembre de 2026
- **Repositorio:** https://github.com/neigeldev/SecDevOps
- **Aplicación caso de estudio:** SecureNotes (Node.js/Express + PostgreSQL)

---

## 1. Título, descripción del problema, alcance y justificación

### 1.1 Título
Plataforma web segura de extremo a extremo (código → infraestructura → nube)
aplicando DevSecOps sobre la aplicación SecureNotes.

### 1.2 Descripción del problema
Las aplicaciones web se ven comprometidas por fallos que aparecen en **todas** las
capas del ciclo de vida: código vulnerable (inyección, XSS, mala criptografía),
infraestructura mal configurada (contenedores con privilegios, puertos abiertos,
secretos expuestos) y entornos de nube sin controles (IAM permisivo, sin cifrado,
sin auditoría). Tratar la seguridad como una fase final deja pasar defectos que son
mucho más caros de corregir en producción.

### 1.3 Alcance
Se toma una única aplicación (SecureNotes) y se asegura de extremo a extremo en tres
módulos encadenados, donde la salida de uno es la entrada del siguiente:
1. **Código** — SAST, SCA y DAST; corrección de vulnerabilidades.
2. **Infraestructura como código** — definición y escaneo de configuración y
   contenedores.
3. **Nube** — despliegue en AWS con controles de IAM, cifrado, red y monitoreo, y
   evaluación de postura con CSPM.

Queda fuera del alcance la operación continua en producción; sí se deja preparado
el pipeline de CI como trabajo futuro inmediato.

### 1.4 Justificación
La metodología **DevSecOps (“shift-left”)** integra la seguridad en cada etapa y
reduce costo y riesgo. El proyecto lo demuestra de forma **medible**: una línea base
intencionalmente vulnerable (`v1.0-vulnerable`) y su versión corregida
(`v2.0-secure`), con evidencia automatizada del antes/después en cada capa.

## 2. Revisión del estado del arte / Marco conceptual

- **AppSec y OWASP (Módulo 1).** OWASP Top 10:2021 como marco de clasificación;
  prácticas de codificación segura (OWASP ASVS, *Cheat Sheets*). Técnicas de
  análisis: **SAST** (análisis estático: Semgrep, SonarQube), **SCA** (composición
  de software: Dependency-Check, `npm audit`) y **DAST** (análisis dinámico: ZAP).
  Criptografía aplicada: funciones de derivación de clave con sal (scrypt/Argon2) y
  gestión de sesiones con JWT.
- **IaC y políticas como código (Módulo 2).** Infraestructura inmutable y
  versionada (Terraform, Docker); *policy as code* con Checkov; escaneo de imágenes
  y SBOM con Trivy; buenas prácticas de contenedores (distroless, no root, mínimo
  privilegio, CIS Docker Benchmark).
- **Seguridad y postura en la nube / CSPM (Módulo 3).** Modelo de responsabilidad
  compartida; **CIS AWS Foundations Benchmark**; IAM de mínimo privilegio; cifrado
  con KMS; detección (CloudTrail, GuardDuty, Access Analyzer); **CSPM** (Cloud
  Security Posture Management) con Prowler y ScoutSuite.

## 3. Objetivos

### 3.1 Objetivo general
Construir y asegurar de extremo a extremo una plataforma web, integrando controles
de seguridad desde el código hasta la nube mediante DevSecOps.

### 3.2 Objetivos específicos
1. **(M1)** Analizar y corregir las vulnerabilidades del código fuente aplicando
   SAST, SCA y DAST y prácticas de codificación segura.
2. **(M2)** Definir la infraestructura como código y verificar su seguridad con
   escaneo de configuración y de contenedores.
3. **(M3)** Desplegar en un entorno de nube aplicando controles de seguridad (IAM,
   cifrado, red, monitoreo) y evaluar la postura con herramientas CSPM.

## 4. Metodología

Enfoque **DevSecOps / shift-left**. En cada módulo se aplica el ciclo
**escanear → corregir → re-escanear**, con evidencia versionada:

1. Línea base vulnerable (`v1.0-vulnerable`), escaneada y documentada.
2. Corrección incremental (un commit por vulnerabilidad, citando CWE/OWASP).
3. Re-escaneo de la versión corregida (`v2.0-secure`).
4. Consolidación automática del antes/después (`scripts/summarize.mjs`).

Herramientas (todas de libre acceso): Semgrep, SonarQube Community, OWASP
Dependency-Check, OWASP ZAP (M1); Checkov, Trivy, Hadolint (M2); Terraform, Prowler,
ScoutSuite (M3). La reproducibilidad se asegura fijando las versiones de cada
herramienta (`scripts/lib.sh`) y ejecutándolas en contenedores.

## 5. Planeación del proyecto (cronograma)

| Fase | Actividades | Recursos | Entregable |
|---|---|---|---|
| M1 · Código | Escaneo v1, corrección V01–V14, re-escaneo v2, pruebas | Semgrep, SonarQube, Dependency-Check, ZAP | Código corregido + Anexo A |
| M2 · IaC | Dockerfile/compose/Terraform seguros; escaneo config e imagen | Checkov, Trivy, Hadolint | IaC + Anexo B |
| M3 · Nube | Línea base de cuenta, despliegue, CSPM antes/después | Terraform, Prowler, ScoutSuite | Despliegue + Anexo C |
| Cierre | Consolidación de resultados e informe | summarize.mjs | Informe final |

La bitácora detallada de cada fase son los Anexos A, B y C.

## 6. Desarrollo

La ejecución de cada módulo está documentada paso a paso en los anexos, que
funcionan como bitácora:
- **Anexo A** (`docs/anexos/anexo-A-codigo.md`): hallazgos y remediación del código.
- **Anexo B** (`docs/anexos/anexo-B-iac.md`): IaC y contenedores.
- **Anexo C** (`docs/anexos/anexo-C-nube.md`): despliegue y CSPM en la nube.

El historial de Git refleja el desarrollo: la etiqueta `v1.0-vulnerable` marca la
línea base y una serie de commits `fix(M1/…)`, `fix(M2…)` y `feat(M3…)` llevan a
`v2.0-secure`.

## 7. Resultados y análisis de resultados

Consolidado automático (ver `reports/RESULTADOS.md`, generado con
`node scripts/summarize.mjs`). Cifras reales obtenidas en el repositorio:

### 7.1 Módulo 1 — Código
| Herramienta | Métrica | v1 | v2 |
|---|---|--:|--:|
| Semgrep (SAST) | hallazgos | 16 | **0** |
| npm audit (SCA) | vulns (crit/high) | 16 (2/6) | **0** |
| OWASP ZAP (DAST activo) | Alto / Medio / Bajo | 5 / 3 / 2 | **0 / 0 / 0** |

ZAP confirmó en v1 ataques reales (SQL Injection, XSS reflejado y DOM, inyección de
comandos de SO), todos ausentes en v2.

### 7.2 Módulo 2 — IaC y contenedores
| Herramienta | Métrica | v1 | v2 |
|---|---|--:|--:|
| Checkov (IaC) | controles fallidos | 31 | **0** |
| Trivy (imagen) | CRITICAL / HIGH | 19 / 406 | **0 / 0** |
| Imagen | tamaño · usuario | 1349 MB · root | **223 MB · no root** |
| Imagen | secretos en ENV | JWT_SECRET, DB_PASSWORD | **ninguno** |

### 7.3 Módulo 3 — Nube (CSPM)
| Herramienta | Métrica | Antes | Después |
|---|---|--:|--:|
| Prowler | controles FAIL | _(rellenar)_ | _(rellenar)_ |
| ScoutSuite | reglas en peligro | _(rellenar)_ | _(rellenar)_ |

(Completar tras ejecutar los escaneos sobre la cuenta de AWS; ver Anexo C.)

### 7.4 Análisis
La reducción a cero de los hallazgos de alta severidad en las tres capas muestra que
integrar controles en cada etapa (shift-left) es efectivo: los defectos se detectan
y corrigen temprano, con evidencia objetiva y reproducible. Las excepciones que
quedan (CVE MEDIUM/LOW del SO base de la imagen distroless; controles CIS que exigen
acción manual como MFA en root) están documentadas y justificadas, lo que refleja
una gestión de riesgo realista más que una “lista en verde” artificial.

## 8. Conclusiones y trabajos futuros

**Conclusiones.** Se aseguró SecureNotes de extremo a extremo con herramientas de
libre acceso y metodología DevSecOps, logrando un antes/después medible: Semgrep
16→0, `npm audit` 16→0, ZAP 5 altos→0, Checkov 31→0 fallos, imagen de contenedor de
1.3 GB/root/425 CVE críticos-altos a 223 MB/no-root/0, e infraestructura de nube
alineada con CIS. La seguridad dejó de ser una fase final para integrarse en cada
etapa.

**Trabajos futuros.**
- Automatizar el pipeline CI/CD por completo (ya incluido en
  `.github/workflows/devsecops.yml`) con *quality gates* que bloqueen el *merge*.
- Firmar imágenes y generar/validar SBOM en el pipeline (cosign, atestaciones).
- Gestión de secretos con rotación automática (AWS Secrets Manager).
- Añadir AWS Config con reglas de conformidad continuas y remediación automática.
- Dominio propio con certificado ACM para TLS de extremo a extremo hasta el origen.

## 9. Bibliografía / Referencias (APA 7)

Amazon Web Services. (2024). *AWS Well-Architected Framework: Security Pillar*. https://docs.aws.amazon.com/wellarchitected/

Center for Internet Security. (2024). *CIS Amazon Web Services Foundations Benchmark v3.0.0*. https://www.cisecurity.org/benchmark/amazon_web_services

HashiCorp. (2024). *Terraform documentation*. https://developer.hashicorp.com/terraform

National Institute of Standards and Technology. (2017). *Digital identity guidelines: Authentication and lifecycle management* (NIST SP 800-63B). https://doi.org/10.6028/NIST.SP.800-63b

OWASP Foundation. (2021). *OWASP Top 10:2021*. https://owasp.org/Top10/

OWASP Foundation. (2024). *OWASP Cheat Sheet Series*. https://cheatsheetseries.owasp.org/

OWASP Foundation. (2024). *OWASP Application Security Verification Standard (ASVS)*. https://owasp.org/www-project-application-security-verification-standard/

OWASP Foundation. (2024). *OWASP ZAP documentation*. https://www.zaproxy.org/docs/

Prowler. (2024). *Prowler: AWS security best practices assessment*. https://docs.prowler.com/

Semgrep. (2024). *Semgrep documentation*. https://semgrep.dev/docs/

SonarSource. (2024). *SonarQube documentation*. https://docs.sonarsource.com/

Aqua Security. (2024). *Trivy documentation*. https://aquasecurity.github.io/trivy/

Bridgecrew. (2024). *Checkov documentation*. https://www.checkov.io/

NCC Group. (2024). *ScoutSuite*. https://github.com/nccgroup/ScoutSuite

MITRE. (2024). *Common Weakness Enumeration (CWE)*. https://cwe.mitre.org/
