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

# Peticiones HTTP sin "-o /dev/null": en Git Bash (MSYS_NO_PATHCONV=1) el curl nativo
# de Windows no entiende /dev/null. El cuerpo se descarta con tuberías de bash.
http_headers() { curl -sS -D - -o - "$1" | sed -n '1,/^\r\{0,1\}$/p'; }
http_status()  { curl -sS -m 8 -o - -w '\n%{http_code} -> %{redirect_url}\n' "$1" 2>&1 | tail -1; }

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
cmd "HTTPS con cabeceras de seguridad (CloudFront + app)" http_headers "$URL/"
cmd "HTTP se redirige a HTTPS" http_status "http://${URL#https://}/"
cmd "Acceso directo al origen EC2 (debe fallar: solo CloudFront)" http_status "http://$ORIGIN/"
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
  --query 'Reservations[0].Instances[0].{IMDSv2:MetadataOptions.HttpTokens,HopLimit:MetadataOptions.HttpPutResponseHopLimit,LlaveSSH:KeyName,IPPublica:PublicIpAddress,PerfilIAM:IamInstanceProfile.Arn}' --output table
cmd "Volúmenes EBS cifrados" aws ec2 describe-volumes --region "$R" \
  --filters "Name=attachment.instance-id,Values=$INSTANCE" --query 'Volumes[].{Id:VolumeId,Cifrado:Encrypted,KMS:KmsKeyId}' --output table
cmd "Cifrado de EBS por defecto en la cuenta" aws ec2 get-ebs-encryption-by-default --region "$R" --output table
cmd "Políticas del rol de la EC2 (mínimo privilegio)" aws iam list-role-policies --role-name securenotes-demo-app --output table
cmd "Política de contraseñas de la cuenta (CIS)" aws iam get-account-password-policy --output table
cmd "Acceso por Session Manager (sin SSH)" aws ssm describe-instance-information --region "$R" \
  --filters "Key=InstanceIds,Values=$INSTANCE" --query 'InstanceInformationList[].{Id:InstanceId,Estado:PingStatus,Agente:AgentVersion}' --output table

log "Cifrado en reposo y secretos"
section "3. Cifrado en reposo y secretos"
KMS_KEY_ID="$(aws kms describe-key --region "$R" --key-id alias/securenotes-demo --query KeyMetadata.KeyId --output text 2>/dev/null || true)"
cmd "CMK de KMS con rotación" aws kms get-key-rotation-status --region "$R" --key-id "$KMS_KEY_ID" --output table
cmd "Secretos en SSM como SecureString (solo metadatos, sin valores)" aws ssm describe-parameters --region "$R" \
  --parameter-filters "Key=Name,Option=BeginsWith,Values=/securenotes" --query 'Parameters[].{Nombre:Name,Tipo:Type,KMS:KeyId}' --output table
cmd "ECR inmutable, escaneo al publicar y cifrado KMS" aws ecr describe-repositories --region "$R" \
  --query 'repositories[?starts_with(repositoryName, `securenotes`)].{Repo:repositoryName,Inmutable:imageTagMutability,Escaneo:imageScanningConfiguration.scanOnPush,Cifrado:encryptionConfiguration.encryptionType}' --output table
cmd "Log groups cifrados con KMS" aws logs describe-log-groups --region "$R" --log-group-name-prefix /securenotes \
  --query 'logGroups[].{Nombre:logGroupName,KMS:kmsKeyId,Retencion:retentionInDays}' --output table

log "Monitoreo y detección"
section "4. Monitoreo y detección"
cmd "CloudTrail (multirregión, validación de integridad, KMS)" aws cloudtrail describe-trails --region "$R" \
  --query 'trailList[].{Nombre:Name,Multirregion:IsMultiRegionTrail,Validacion:LogFileValidationEnabled,KMS:KmsKeyId}' --output table
cmd "GuardDuty activo" aws guardduty list-detectors --region "$R" --output table
cmd "IAM Access Analyzer" aws accessanalyzer list-analyzers --region "$R" --query 'analyzers[].{Nombre:name,Tipo:type,Estado:status}' --output table
cmd "Alarmas de CloudWatch" aws cloudwatch describe-alarms --region "$R" \
  --query 'MetricAlarms[].{Alarma:AlarmName,Estado:StateValue}' --output table
cmd "WAF asociado a CloudFront" aws wafv2 list-web-acls --region us-east-1 --scope CLOUDFRONT --query 'WebACLs[].Name' --output table

ok "Reporte de verificación: $REPORT"
