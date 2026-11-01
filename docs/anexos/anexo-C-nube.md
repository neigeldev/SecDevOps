# Anexo C — Módulo 3: Seguridad en la nube

**Objetivo:** desplegar la aplicación en un entorno de nube real aplicando
controles de seguridad y evaluando la postura con herramientas CSPM.

**Entregable:** despliegue funcional + informe de configuración de seguridad (IAM,
cifrado, red, monitoreo) + reporte CSPM.

**Herramientas de libre acceso:** AWS Free Tier, Terraform, Prowler, ScoutSuite.

> **Importante (costos y limpieza):** este módulo crea recursos reales en AWS.
> Define un presupuesto con alertas (`alert_email` en `account-baseline`) y, al
> terminar de capturar evidencias, ejecuta **`./scripts/m3-destroy.sh all`**.

---

## C.1 Arquitectura desplegada

```
          Internet (HTTPS)
                │
        ┌───────▼────────┐   AWS WAF (Common, KnownBadInputs/Log4j, SQLi,
        │   CloudFront    │◄── IP reputation, rate limit) + logs cifrados
        └───────┬────────┘
                │ HTTP + encabezado secreto de origen (X-Origin-Verify)
      VPC 10.20.0.0/16
        ┌───────▼─────────────── subred pública ───────────────┐
        │  EC2 t3.micro (Amazon Linux 2023)                     │
        │  · SG: entra solo desde la prefix list de CloudFront  │
        │  · sin SSH (Session Manager), IMDSv2, EBS cifrado KMS  │
        │  · contenedor no root, read-only, logs → CloudWatch    │
        └───────┬───────────────────────────────────────────────┘
                │ TLS 5432 (SG dedicado)
        ┌───────▼─────────── subredes privadas (2 AZ) ──────────┐
        │  RDS PostgreSQL  · cifrado KMS · rds.force_ssl=1       │
        │  · sin acceso público · backups · logs → CloudWatch    │
        └───────────────────────────────────────────────────────┘

Transversal: KMS (CMK con rotación) · SSM Parameter Store (secretos) ·
ECR (imagen) · CloudTrail + GuardDuty + Access Analyzer · SNS (alertas)
```

Archivos: `infra/terraform/app/` (aplicación) y
`infra/terraform/account-baseline/` (cuenta).

## C.2 Controles de seguridad por dominio

### IAM
- Política de contraseñas CIS (14+ caracteres, complejidad, histórico 24, 90 días).
- **Rol de la EC2 de mínimo privilegio**: solo leer `/<project>/*` en SSM,
  descifrar vía SSM/ECR, bajar la imagen de su repo y escribir en su log group.
- **Rol de auditoría de solo lectura** (`SecurityAudit` + `ViewOnlyAccess`) para
  Prowler/ScoutSuite: separa la auditoría de las credenciales de administración.
- **IAM Access Analyzer** activo; rol de AWS Support (CIS 1.17).
- Manuales (no automatizables): MFA en root, no usar root, eliminar llaves de root.

### Cifrado
- **En reposo:** CMK de KMS con rotación anual; cifran EBS, RDS, ECR, parámetros
  SSM, logs de CloudWatch y SNS. **Cifrado de EBS por defecto** en la cuenta.
- **En tránsito:** HTTPS del usuario a CloudFront; `rds.force_ssl=1` obliga TLS a la
  base de datos; la app valida el certificado de RDS.

### Red
- VPC propia segmentada; EC2 solo accesible desde CloudFront; **RDS sin acceso
  público**; **S3 Block Public Access a nivel de cuenta**; SG por defecto sin reglas;
  VPC Flow Logs; bloqueo de instantáneas EBS públicas.

### Monitoreo y detección
- **CloudTrail** multirregión con validación de integridad, cifrado KMS y envío a
  CloudWatch Logs; eventos de datos de S3.
- **15 alarmas CIS (4.1–4.15)**: uso de root, login sin MFA, cambios de IAM,
  CloudTrail, SG, NACL, rutas, etc. → **SNS**.
- **GuardDuty** con alertas de severidad alta (EventBridge → SNS).
- Alarmas sobre los **eventos de seguridad de la propia app** (login_failed,
  csrf_failed, access_denied, 5xx) emitidos por el logger del Módulo 1.
- Opcionales: **Security Hub** (estándar CIS v3.0) y **AWS Config**.

## C.3 Paso a paso del despliegue y la evaluación CSPM

Requisitos: AWS CLI v2 autenticado (`aws configure` o `aws sso login`), Terraform
1.11+, Docker. Región sugerida: `us-east-1`.

```bash
export AWS_REGION=us-east-1

# 1) Postura ANTES de endurecer la cuenta (línea base real de tu cuenta)
./scripts/m3-prowler.sh before          # reports/m3/prowler-before/
./scripts/m3-scoutsuite.sh before       # reports/m3/scoutsuite-before/

# 2) Aplicar la línea base de seguridad de la cuenta
./scripts/m3-apply.sh account
#    Confirma por correo la suscripción al tópico SNS de alertas.

# 3) Desplegar la aplicación (construye y publica la imagen, crea CloudFront/EC2/RDS)
./scripts/m3-apply.sh app
#    La salida 'app_url' es la URL HTTPS pública (CloudFront).
#    La instancia tarda 2-4 min en arrancar el servicio.

# 4) Postura DESPUÉS
./scripts/m3-prowler.sh after           # reports/m3/prowler-after/
./scripts/m3-scoutsuite.sh after        # reports/m3/scoutsuite-after/

# 5) Consolidar y, al terminar, DESTRUIR todo
node scripts/summarize.mjs
./scripts/m3-destroy.sh all
```

## C.4 Verificación del despliegue (evidencias)

- `terraform -chdir=infra/terraform/app output app_url` → abrir en el navegador:
  la app responde por **HTTPS** (candado). Capturar.
- **Acceso directo al origen bloqueado:** abrir `http://<origin_public_dns>` (salida
  `origin_public_dns`) → debe fallar (SG + encabezado de origen). Capturar.
- **Sin SSH:** `aws ssm start-session --target <instance_id>` entra sin llaves.
- **RDS privada:** no tiene endpoint público (salida `rds_endpoint` es interna).
- **Cabeceras de seguridad** en la respuesta de CloudFront (HSTS, CSP, X-Frame…).

**Capturas sugeridas** (`docs/anexos/img/`): `m3-app-https.png`,
`m3-origin-blocked.png`, `m3-prowler-before.png`, `m3-prowler-after.png`,
`m3-scoutsuite-after.png`, `m3-guardduty.png`, `m3-cloudtrail.png`.

## C.5 Resultados CSPM (antes / después)

> Completar con los valores de `reports/m3/*/summary.json` tras ejecutar los
> escaneos (o con la tabla de `reports/RESULTADOS.md`).

| Herramienta | Métrica | Antes | Después |
|---|---|--:|--:|
| Prowler | controles FAIL | _(rellenar)_ | _(rellenar)_ |
| Prowler | controles PASS | _(rellenar)_ | _(rellenar)_ |
| Prowler | FAIL críticos/altos | _(rellenar)_ | _(rellenar)_ |
| ScoutSuite | reglas en peligro | _(rellenar)_ | _(rellenar)_ |
| ScoutSuite | ítems marcados | _(rellenar)_ | _(rellenar)_ |

**Hallazgos típicos que corrige la línea base** (para comentar en el informe):
CloudTrail ausente o sin cifrar, EBS sin cifrado por defecto, política de
contraseñas débil, S3 sin *Block Public Access*, SG por defecto permisivo, sin
GuardDuty, sin Access Analyzer. Los hallazgos de MFA en root y de uso de root
requieren acción **manual** en la consola (se documentan como tales).

## C.6 Nota sobre entornos sin AWS real

Prowler y ScoutSuite están pensados para cuentas reales. Si no se dispone de AWS,
puede emularse parcialmente con **LocalStack**, pero muchos controles (GuardDuty,
Access Analyzer, Security Hub) no existen allí, por lo que el reporte CSPM sería
parcial. Se recomienda AWS Free Tier o Azure for Students.

## C.7 Conclusión del módulo

La cuenta y la aplicación quedan desplegadas con controles de IAM, cifrado, red y
monitoreo alineados con CIS AWS Foundations, y la mejora de postura se mide con dos
herramientas CSPM independientes (Prowler y ScoutSuite) en un claro antes/después.
