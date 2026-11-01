# SecureNotes — Plataforma web segura: del código a la nube

Proyecto final integrador del módulo **Desarrollo seguro, criptografía e IAM**
(Diplomado DevOps). Toma una única aplicación web —**SecureNotes**, una app de
notas hecha para el curso— y la asegura de extremo a extremo con la metodología
**DevSecOps (“shift-left”)** en tres módulos encadenados: el **código**, la
**infraestructura** que lo despliega y el **entorno de nube** que lo aloja.

La estrategia es un **antes/después medible**: el repositorio contiene una línea
base intencionalmente insegura (`v1.0-vulnerable`) y su versión corregida
(`v2.0-secure`). Cada módulo **escanea → corrige → vuelve a escanear** y guarda la
evidencia en `reports/`.

> ⚠️ La versión v1 es **vulnerable a propósito** (material didáctico). No la
> despliegues en un entorno accesible desde Internet.

## Resultados (antes / después)

Generado con `node scripts/summarize.mjs` a partir de los reportes reales de este
repositorio (ver `reports/RESULTADOS.md`):

| Módulo | Herramienta | Métrica | v1 | v2 |
|---|---|--:|--:|--:|
| M1 | Semgrep (SAST) | hallazgos | **16** | **0** |
| M1 | npm audit (SCA) | vulns (crit/high) | **16** (2/6) | **0** |
| M2 | Checkov (IaC) | controles fallidos | **31** | **0** |
| M2 | Trivy (imagen) | CRITICAL / HIGH | **19 / 406** | **0 / 0** |
| M2 | Imagen | tamaño · usuario | 1349 MB · root | 223 MB · no root |
| M3 | Prowler / ScoutSuite | hallazgos cuenta | antes | después |

(Las filas de M3 se completan al ejecutar los escaneos sobre tu cuenta de AWS.)

## Las tres capas

| Módulo | Objetivo | Carpeta | Herramientas (libres) | Evidencia |
|---|---|---|---|---|
| **M1 — Código** | SAST, SCA y DAST; corregir el código | `app/` | Semgrep, SonarQube CE, OWASP Dependency-Check, OWASP ZAP | `reports/m1`, Anexo A |
| **M2 — IaC** | IaC + escaneo de configuración y contenedores | `infra/` | Checkov, Trivy, Hadolint | `reports/m2`, Anexo B |
| **M3 — Nube** | Desplegar en AWS con controles y evaluar postura (CSPM) | `infra/terraform` + `scripts/m3-*` | Terraform, Prowler, ScoutSuite | `reports/m3`, Anexo C |

## Estructura del repositorio

```
app/                     Aplicación Node.js/Express + PostgreSQL (SecureNotes)
  src/                   código (rutas, middleware, security/)
  views/  public/        plantillas EJS y estáticos
  test/                  pruebas unitarias de los controles de seguridad
  Dockerfile             imagen endurecida (multi-stage, distroless, no root)
infra/
  docker/                docker-compose endurecido + proxy TLS (Caddy)
  terraform/app/         stack de la app en AWS (VPC, CloudFront+WAF, EC2, RDS, KMS…)
  terraform/account-baseline/  línea base CIS de la cuenta (CloudTrail, IAM, GuardDuty…)
scripts/                 un script por herramienta (ver abajo) + summarize.mjs
security/semgrep/        reglas Semgrep propias (política como código)
reports/                 evidencias generadas (m1, m2, m3) + RESULTADOS.md
docs/                    informe y Anexos A/B/C
.github/workflows/       pipeline DevSecOps (SAST/SCA/IaC/imagen en cada push)
```

## Requisitos

- Docker y Docker Compose
- Node.js 22+ y npm (para pruebas y para `summarize.mjs`)
- Terraform 1.11+ y AWS CLI v2 (solo Módulo 3)
- **Clave API de NVD** (gratis) para Dependency-Check:
  <https://nvd.nist.gov/developers/request-an-api-key>

Guarda las claves locales en `.secrets.env` (ignorado por Git):

```bash
echo 'NVD_API_KEY=tu-clave-aqui' > .secrets.env
```

## Uso en Windows (Git Bash)

Los scripts detectan automáticamente Git Bash / MSYS2 / Cygwin y aplican dos
ajustes que evitan los problemas típicos con Docker Desktop en Windows:

1. **`MSYS_NO_PATHCONV=1`** — desactiva la conversión automática de rutas
   (`/src` → `C:\src`) que Git Bash aplica a los argumentos de Docker.
2. **Sin `--user`** — `id -u` / `id -g` no tienen sentido en Windows;
   los contenedores corren con el usuario por defecto de la imagen.

**Requisitos previos en Windows:**

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y
  en ejecución (backend WSL 2 recomendado).
- [Git for Windows](https://gitforwindows.org/) (incluye Git Bash).
- Node.js 22+ instalado en Windows (para `npm audit` y `summarize.mjs`).
- Abre una terminal **Git Bash** (no PowerShell ni CMD) y ejecuta los scripts
  con `./scripts/m1-semgrep.sh v1` etc.

**Si Dependency-Check falla con código 1:**

1. Asegúrate de tener `.secrets.env` con tu clave NVD:
   ```bash
   echo 'NVD_API_KEY=tu-clave-aqui' >> .secrets.env
   ```
2. La primera ejecución descarga la base NVD (~10-30 min); revisa el log:
   ```bash
   cat reports/m1/v1/dependency-check.log | tail -30
   ```
3. Si el log muestra errores de red/TLS, puede deberse al proxy corporativo.
   Define `EXTRA_CA_FILE=/ruta/al/certificado-proxy.pem` en `.secrets.env`.

## Guía rápida

```bash
# 0) Versiones: v1 (vulnerable) sale del tag v1.0-vulnerable; v2 (segura) es el HEAD.
#    Los scripts preparan v1 en .worktrees/v1 automáticamente.

# --- Módulo 1: código ---
./scripts/m1-semgrep.sh v1      && ./scripts/m1-semgrep.sh v2
./scripts/m1-sca.sh v1          && ./scripts/m1-sca.sh v2
./scripts/m1-sonarqube.sh v1    && ./scripts/m1-sonarqube.sh v2
./scripts/m1-zap.sh v1 full     && ./scripts/m1-zap.sh v2 full

# --- Módulo 2: IaC y contenedores ---
./scripts/m2-iac-scan.sh v1     && ./scripts/m2-iac-scan.sh v2
./scripts/m2-image-scan.sh v1   && ./scripts/m2-image-scan.sh v2
./scripts/m2-runtime-check.sh v2

# --- Módulo 3: nube (requiere credenciales de AWS) ---
export AWS_REGION=us-east-1
./scripts/m3-prowler.sh before          # línea base de tu cuenta (antes)
./scripts/m3-apply.sh account           # aplica la línea base de seguridad
./scripts/m3-apply.sh app               # despliega la app (CloudFront+EC2+RDS)
./scripts/m3-prowler.sh after           # vuelve a medir
./scripts/m3-scoutsuite.sh after        # segunda herramienta CSPM
./scripts/m3-destroy.sh all             # ¡destruye todo para no generar costos!

# --- Tabla consolidada antes/después ---
node scripts/summarize.mjs
```

## Ejecutar la app en local (versión segura)

```bash
./scripts/gen-secrets.sh
docker compose -f infra/docker/docker-compose.yml -p securenotes-v2 up -d --build
# https://localhost:8443  (usuario admin; la contraseña la imprime gen-secrets.sh)
```

## Las 14 vulnerabilidades (V01–V14) y su corrección

Cada corrección es un commit `fix(M1/Vxx…)` o `fix(M2…)` independiente. Ver el
detalle en `docs/anexos/anexo-A-codigo.md` (M1) y `docs/anexos/anexo-B-iac.md` (M2).

| ID | Vulnerabilidad | OWASP 2021 | Corrección |
|---|---|---|---|
| V01 | Inyección SQL en login | A03 | Consultas parametrizadas |
| V02 | Inyección SQL en búsqueda | A03 | Consultas parametrizadas + escape LIKE |
| V03 | XSS (reflejado y almacenado) | A03 | Escape de salida EJS + CSP |
| V04 | Inyección de comandos (`/api/diag`) | A03 | Sin shell (dns.lookup) + lista blanca + admin |
| V05 | Contraseñas con MD5 | A02 | scrypt con sal + verificación en tiempo constante |
| V06 | Secretos en el código | A05/A07 | Variables/archivos + SSM; validación de longitud |
| V07 | JWT sin exp/alg; cookie insegura | A07/A05 | alg fijo, exp, iss/aud; cookie `__Host-` HttpOnly/Secure/SameSite |
| V08 | IDOR en notas | A01 | Control de acceso por dueño; 404 |
| V09 | Asignación masiva (rol) | A01 | Lista blanca de campos; rol desde BD |
| V10 | Falta de cabeceras / CSRF | A05 | helmet (CSP, HSTS…), CSRF double-submit firmado |
| V11 | Stack traces al cliente | A05 | Manejador de errores con ID de referencia |
| V12 | Logs con secretos / sin eventos | A09 | Logger que filtra secretos + eventos de seguridad |
| V13 | Sin límite de intentos | A07 | express-rate-limit en login/registro |
| V14 | Dependencias vulnerables | A06 | Actualización + lockfile + `npm audit` 0 |

## Documentación

- `docs/informe/informe-final.md` — informe final (plantilla institucional).
- `docs/anexos/anexo-A-codigo.md` — Anexo A (Módulo 1).
- `docs/anexos/anexo-B-iac.md` — Anexo B (Módulo 2).
- `docs/anexos/anexo-C-nube.md` — Anexo C (Módulo 3).

## Aviso

Software educativo. La rama/tag `v1.0-vulnerable` contiene fallos deliberados;
úsalo solo en entornos locales y aislados.
