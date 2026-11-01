#!/usr/bin/env bash
# Módulo 3 · Verificación de los controles de seguridad desplegados en AWS
# Genera reports/m3/verificacion.md con evidencias de IAM, cifrado, red y monitoreo.
# Solo consulta configuración (lecturas) y hace peticiones normales a la app.
source "$(dirname "$0")/lib.sh"
need terraform
need aws
need curl

TF_DIR="$ROOT/infra/terraform/app"
OUT="$(report_dir m3 despliegue)"
REPORT="$OUT/verificacion.md"
tfo() { terraform -chdir="$TF_DIR" output -raw "$1"; }

URL="$(tfo app_url)"
ORIGIN="$(tfo origin_public_dns)"
INSTANCE="$(tfo instance_id)"
DB_ID="securenotes-demo-db"
R="$AWS_REGION"

section() { printf '\n## %s\n\n' "$1" >>"$REPORT"; }
cmd() { # cmd <descripción> <comando...>
  printf '**%s**\n\n```text\n$ %s\n' "$1" "${*:2}" >>"$REPORT"
  "${@:2}" >>"$REPORT" 2>&1 || true
  printf '```\n\n' >>"$REPORT"
}

{
  echo "# Verificación del despliegue de SecureNotes en AWS"
  echo
  echo "- Fecha: $(date -u '+%Y-%m-%d %H:%M UTC')"
  echo "- URL pública: $URL"
  echo "- Cuenta: $(aws sts get-caller-identity --query Account --output text)"
} >"$REPORT"

log "Red y transporte"
section "1. Red y cifrado en tránsito"
cmd "HTTPS con cabeceras de seguridad (CloudFront + app)" curl -sS -o /dev/null -D - "$URL/"
cmd "HTTP se redirige a HTTPS" curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "http://${URL#https://}/"
cmd "Acceso directo al origen EC2 (debe fallar: solo CloudFront)" curl -sS -m 8 -o /dev/null -w '%{http_code}\n' "http://$ORIGIN/"
cmd "Grupo de seguridad de la EC2 (solo prefix list de CloudFront, sin SSH)" \
  aws ec2 describe-security-group-rules --region "$R" \
  --filters "Name=group-id,Values=$(aws ec2 describe-instances --region "$R" --instance-ids "$INSTANCE" --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)" \
  --query 'SecurityGroupRules[].{Egreso:IsEgress,Proto:IpProtocol,Desde:FromPort,Hasta:ToPort,CIDR:CidrIpv4,PrefixList:PrefixListId,SG:ReferencedGroupInfo.GroupId}' --output table
cmd "RDS no es pública" aws rds describe-db-instances --region "$R" --db-instance-identifier "$DB_ID" \
  --query 'DBInstances[0].{Publica:PubliclyAccessible,Cifrada:StorageEncrypted,KMS:KmsKeyId,MultiAZ:MultiAZ,Backups:BackupRetentionPeriod,ProteccionBorrado:DeletionProtection,IAMAuth:IAMDatabaseAuthenticationEnabled}' --output table
cmd "TLS obligatorio en PostgreSQL (rds.force_ssl)" aws rds describe-db-parameters --region "$R" \
  --db-parameter-group-name "securenotes-demo-pg17" --query "Parameters[?ParameterName=='rds.force_ssl'].[ParameterName,ParameterValue]" --output table

log "Cómputo e IAM"
section "2. Cómputo e identidades (IAM)"
cmd "IMDSv2 obligatorio, sin llave SSH, EBS cifrado" aws ec2 describe-instances --region "$R" --instance-ids "$INSTANCE" \
  --query 'Reservations[0].Instances[0].{IMDSv2:MetadataOptions.HttpTok