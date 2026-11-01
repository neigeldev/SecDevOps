# Anexo B — Módulo 2: Infraestructura como código (IaC)

**Objetivo:** definir la infraestructura de la aplicación como código y verificar
su seguridad mediante escaneo de configuración y de contenedores.

**Entregable:** archivos IaC (Dockerfile, docker-compose, Terraform) + esta
explicación y paso a paso.

**Herramientas de libre acceso:** Checkov, Trivy (config e imagen), Hadolint.

---

## B.1 Qué se define como código

| Capa | Archivos | Qué describe |
|---|---|---|
| Imagen de contenedor | `app/Dockerfile`, `app/.dockerignore` | cómo se empaqueta la app |
| Orquestación local | `infra/docker/docker-compose.yml`, `infra/docker/Caddyfile` | app + BD + proxy TLS endurecidos |
| Nube (app) | `infra/terraform/app/*.tf` | VPC, CloudFront+WAF, EC2, RDS, KMS, ECR, SSM, monitoreo |
| Nube (cuenta) | `infra/terraform/account-baseline/*.tf` | línea base CIS de la cuenta (ver Anexo C) |

Igual que en el Módulo 1 hay dos versiones: la IaC **insegura** (tag
`v1.0-vulnerable`) y la **segura** (`v2.0-secure`).

## B.2 Metodología y comandos

```bash
./scripts/m2-iac-scan.sh v1    && ./scripts/m2-iac-scan.sh v2     # Checkov + Trivy config + Hadolint
./scripts/m2-image-scan.sh v1  && ./scripts/m2-image-scan.sh v2   # Trivy image + SBOM + metadatos
./scripts/m2-runtime-check.sh v2                                  # configuración en ejecución
```

Los reportes quedan en `reports/m2/v1` y `reports/m2/v2`.

## B.3 Resumen cuantitativo (antes / después)

| Herramienta | Métrica | v1 | v2 |
|---|---|--:|--:|
| Checkov (Terraform + Dockerfile) | controles **fallidos** | **31** | **0** |
| Checkov | controles superados | 50 | 444 |
| Trivy config | fallos CRITICAL/HIGH | 4 / 9 | 0 / 0 |
| Trivy image | vulnerabilidades CRITICAL | **19** | **0** |
| Trivy image | vulnerabilidades HIGH | **406** | **0** |
| Trivy image | MEDIUM / LOW | 538 / 117 | 24 / 8 |
| Hadolint | advertencias | 3 | 0 |
| Imagen | tamaño | **1349 MB** | **223 MB** |
| Imagen | usuario de ejecución | **root** | **65532 (no root)** |
| Imagen | secretos en variables | **JWT_SECRET, DB_PASSWORD** | **ninguno** |

**Capturas sugeridas** (`docs/anexos/img/`): `m2-checkov-v1.png`,
`m2-checkov-v2.png`, `m2-trivy-image-v1.png`, `m2-trivy-image-v2.png`,
`m2-hadolint-v1.png`.

## B.4 El Dockerfile: de inseguro a endurecido

**v1 (inseguro)** — hallazgos de Hadolint y Trivy:
- Base `node:16` (obsoleta, sin fijar versión concreta): cientos de CVE del SO.
- Ejecuta como **root**.
- `ENV JWT_SECRET=…` y `ENV DB_PASSWORD=…`: **secretos horneados en la imagen**.
- `npm install` (no `ci`) y copia de todo el contexto; imagen de **1.3 GB**.
- `CMD npm start` en forma shell; sin `HEALTHCHECK`.

**v2 (endurecido)** — `app/Dockerfile`:
- **Multi-etapa**: las dependencias se instalan con `npm ci --omit=dev
  --ignore-scripts` en una etapa y solo los artefactos pasan a la final.
- Imagen final **distroless** (`gcr.io/distroless/nodejs24-debian13:nonroot`),
  **fijada por versión y digest**: sin shell, sin gestor de paquetes, superficie mínima.
- Usuario **no root** (`65532`), `HEALTHCHECK` propio, `CMD` en forma exec.
- **Sin secretos**: se inyectan en ejecución (`*_FILE` / SSM).
- `.dockerignore` evita meter `node_modules`, `.env`, `.git`, pruebas, etc.
- Resultado: **223 MB** y **0 CVE CRITICAL/HIGH** (los MEDIUM/LOW restantes son del
  SO base distroless y sin corrección disponible).

## B.5 docker-compose endurecido

`infra/docker/docker-compose.yml` aplica a los tres servicios:

- `read_only: true`, `cap_drop: [ALL]`, `no-new-privileges`, usuarios no root,
  límites de memoria/CPU/PIDs y rotación de logs.
- **Segmentación de red:** la base de datos va en una red `backend` marcada
  `internal: true` (**sin salida a Internet**) y **no publica puertos**; solo el
  proxy expone `127.0.0.1:8443`.
- **TLS**: proxy inverso **Caddy** con HTTPS y HSTS por delante de la app.
- **Secretos** con *Docker secrets* (`*_FILE`), generados por
  `scripts/gen-secrets.sh` (carpeta ignorada por Git); PostgreSQL con `scram-sha-256`.

Evidencia de la configuración **en ejecución** (`reports/m2/v2/runtime-config.md`):

| Servicio | Usuario | FS solo lectura | cap_drop | no-new-privileges | Puertos | Memoria | Secretos en ENV |
|---|---|---|---|---|---|---|---|
| app | 65532 | sí | ALL | sí | ninguno | 512 MiB | ninguna |
| db | 70 | sí | ALL | sí | ninguno | 512 MiB | ninguna |
| proxy | root | sí | ALL (+NET_BIND_SERVICE) | sí | 127.0.0.1:8443 | 128 MiB | ninguna |

Redes: `backend` internal=true · `frontend` internal=false.

## B.6 Terraform de la aplicación (`infra/terraform/app`)

**v1 (inseguro)** concentraba los 31 fallos de Checkov: SSH (22) y PostgreSQL
(5432) abiertos a `0.0.0.0/0`, rol IAM con `Action:*`/`Resource:*`, IMDSv1, EBS sin
cifrar, bucket S3 **público** y secretos en `user_data`.

**v2 (seguro)** se reescribe en módulos:
- **Red:** VPC propia segmentada; la EC2 (subred pública) **solo acepta tráfico de
  CloudFront** (prefix list administrada); RDS en subredes privadas **sin ruta a
  Internet**; NACL privada; SG por defecto sin reglas; **VPC Flow Logs**.
- **Entrada:** **CloudFront** con HTTPS obligatorio, política de cabeceras de
  seguridad, **encabezado secreto de origen** y **AWS WAF** (Common, KnownBadInputs
  —Log4Shell—, SQLi, IP reputation, *rate limit*) con logs cifrados.
- **Cómputo:** EC2 **sin SSH** (Session Manager), **IMDSv2** con *hop limit* 1, EBS
  cifrado con KMS; el contenedor corre endurecido y envía logs a CloudWatch.
- **Datos:** RDS PostgreSQL cifrado (KMS), **TLS forzado** (`rds.force_ssl`),
  backups, logs exportados, monitoreo mejorado, protección contra borrado.
- **Secretos:** recursos **efímeros** + argumentos *write-only* → **no quedan en el
  `tfstate`**; se guardan en **SSM SecureString** cifrados con KMS. Rol IAM de
  **mínimo privilegio** (solo leer `/<project>/*`, descifrar vía SSM/ECR, bajar la
  imagen y escribir en su log group).
- **Registro/monitoreo:** ECR inmutable con escaneo al publicar; CMK con rotación;
  alarmas de CloudWatch sobre los eventos de seguridad de la app → SNS cifrado.

Resultado Checkov v2: **0 fallos**, 444 controles superados, 18 excepciones **con
justificación escrita** en el propio código (`#checkov:skip=… :motivo`), por
ejemplo Multi-AZ y Performance Insights desactivados para permanecer en la capa
gratuita.

## B.7 Paso a paso (reproducir el antes/después)

1. `./scripts/m2-iac-scan.sh v1` → abrir `reports/m2/v1/checkov.txt` (31 fallos) y
   `trivy-config.txt`. Capturar.
2. `./scripts/m2-image-scan.sh v1` → `reports/m2/v1/trivy-image.txt` (19 CRITICAL /
   406 HIGH) e `image-inspect.json` (root, 1.3 GB, secretos en ENV). Capturar.
3. `./scripts/m2-iac-scan.sh v2` y `./scripts/m2-image-scan.sh v2` → 0 fallos, 0
   CRITICAL/HIGH, imagen no root de 223 MB sin secretos. Capturar.
4. `./scripts/m2-runtime-check.sh v2` → tabla de configuración en ejecución.
5. `node scripts/summarize.mjs` → tabla consolidada.

## B.8 Conclusión del módulo

La infraestructura queda descrita como código, versionada y validada: Checkov pasa
de 31 a 0 fallos, la imagen de 1.3 GB como root con 425 CVE CRITICAL/HIGH a 223 MB
sin root y sin CVE CRITICAL/HIGH, y los contenedores corren con mínimo privilegio y
red segmentada. Las excepciones restantes están documentadas y justificadas.
