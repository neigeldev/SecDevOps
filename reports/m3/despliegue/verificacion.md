# Verificación del despliegue de SecureNotes en AWS

- Fecha: 2026-11-02 01:40 UTC
- URL pública: https://dx0g80ipz8xfv.cloudfront.net
- Cuenta: 264350941467

## 1. Red y cifrado en tránsito

**HTTPS con cabeceras de seguridad (CloudFront + app)**

```text
$ curl -sS -o /dev/null -D - https://dx0g80ipz8xfv.cloudfront.net/
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 916
Connection: keep-alive
Content-Security-Policy: default-src 'self';base-uri 'self';font-src 'self';form-action 'self';frame-ancestors 'none';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self';upgrade-insecure-requests;connect-src 'self'
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: DENY
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
RateLimit: "300-in-1min"; r=299; t=60
RateLimit-Policy: "300-in-1min"; q=300; w=60; pk=:YjY0ZWIyMzAxZDU1:
Cache-Control: no-store
Set-Cookie: __Host-csrf=YF4e5DYjMj8B90XlmBXYLpuOh6VaekzR8kETOyBBTLw; Path=/; HttpOnly; Secure; SameSite=Strict
ETag: W/"394-kcaxRrzLmzx5sedP7zhxCiyGUzg"
Date: Mon, 02 Nov 2026 01:40:35 GMT
X-Cache: Miss from cloudfront
Via: 1.1 f2bb46a4ce4daa0df0a0177515c763fc.cloudfront.net (CloudFront)
X-Amz-Cf-Pop: MIA50-P4
Alt-Svc: h3=":443"; ma=86400
X-Amz-Cf-Id: _EHLnqsQynsX500fgkA60r64vwAMEWszkuKH4OT_KdlLdBB8hOz1iw==

curl: (23) client returned ERROR on write of 916 bytes
```

**HTTP se redirige a HTTPS**

```text
$ curl -sS -o /dev/null -w %{http_code} -> %{redirect_url}\n http://dx0g80ipz8xfv.cloudfront.net/
301 -> 
curl: (23) client returned ERROR on write of 167 bytes
```

**Acceso directo al origen EC2 (debe fallar: solo CloudFront)**

```text
$ curl -sS -m 8 -o /dev/null -w %{http_code}\n http://ec2-18-209-237-232.compute-1.amazonaws.com/
000
curl: (28) Connection timed out after 8004 milliseconds
```

**Grupo de seguridad de la EC2 (solo prefix list de CloudFront, sin SSH)**

```text
$ aws ec2 describe-security-group-rules --region us-east-1 --filters Name=group-id,Values=sg-02287af2bd6295e3a --query SecurityGroupRules[].{Egreso:IsEgress,Proto:IpProtocol,Desde:FromPort,Hasta:ToPort,CIDR:CidrIpv4,PrefixList:PrefixListId,SG:ReferencedGroupInfo.GroupId} --output table
-------------------------------------------------------------------------------------------
|                               DescribeSecurityGroupRules                                |
+-----------+--------+---------+--------+--------------+--------+-------------------------+
|   CIDR    | Desde  | Egreso  | Hasta  | PrefixList   | Proto  |           SG            |
+-----------+--------+---------+--------+--------------+--------+-------------------------+
|  0.0.0.0/0|  443   |  True   |  443   |  None        |  tcp   |  None                   |
|  None     |  5432  |  True   |  5432  |  None        |  tcp   |  sg-05d19df6bde85eaa3   |
|  None     |  80    |  False  |  80    |  pl-3b927c52 |  tcp   |  None                   |
+-----------+--------+---------+--------+--------------+--------+-------------------------+
```

**RDS no es pública**

```text
$ aws rds describe-db-instances --region us-east-1 --db-instance-identifier securenotes-demo-db --query DBInstances[0].{Publica:PubliclyAccessible,Cifrada:StorageEncrypted,KMS:KmsKeyId,MultiAZ:MultiAZ,Backups:BackupRetentionPeriod,ProteccionBorrado:DeletionProtection,IAMAuth:IAMDatabaseAuthenticationEnabled} --output table
------------------------------------------------------------------------------------------------------
|                                         DescribeDBInstances                                        |
+-------------------+--------------------------------------------------------------------------------+
|  Backups          |  1                                                                             |
|  Cifrada          |  True                                                                          |
|  IAMAuth          |  True                                                                          |
|  KMS              |  arn:aws:kms:us-east-1:264350941467:key/be643320-a452-4c1f-95b3-6574e133fdd6   |
|  MultiAZ          |  False                                                                         |
|  ProteccionBorrado|  True                                                                          |
|  Publica          |  False                                                                         |
+-------------------+--------------------------------------------------------------------------------+
```

**TLS obligatorio en PostgreSQL (rds.force_ssl)**

```text
$ aws rds describe-db-parameters --region us-east-1 --db-parameter-group-name securenotes-demo-pg17 --query Parameters[?ParameterName=='rds.force_ssl'].[ParameterName,ParameterValue] --output table
------------------------
| DescribeDBParameters |
+-----------------+----+
|  rds.force_ssl  |  1 |
+-----------------+----+
```


## 2. Cómputo e identidades (IAM)

**IMDSv2 obligatorio, sin llave SSH, EBS cifrado**

```text
$ aws ec2 describe-instances --region us-east-1 --instance-ids i-048752feab5e38e63 --query Reservations[0].Instances[0].{IMDSv2:MetadataOptions.HttpTokens,HopLimit:MetadataOptions.HttpPutResponseHopLimit,LlaveSSH:KeyName,IPPublica:PublicIpAddress,PerfilIAM:IamInstanceProfile.Arn} --output table
----------------------------------------------------------------------------------
|                                DescribeInstances                               |
+-----------+--------------------------------------------------------------------+
|  HopLimit |  1                                                                 |
|  IMDSv2   |  required                                                          |
|  IPPublica|  18.209.237.232                                                    |
|  LlaveSSH |  None                                                              |
|  PerfilIAM|  arn:aws:iam::264350941467:instance-profile/securenotes-demo-app   |
+-----------+--------------------------------------------------------------------+
```

**Volúmenes EBS cifrados**

```text
$ aws ec2 describe-volumes --region us-east-1 --filters Name=attachment.instance-id,Values=i-048752feab5e38e63 --query Volumes[].{Id:VolumeId,Cifrado:Encrypted,KMS:KmsKeyId} --output table
--------------------------------------------------------------------------------------------
|                                      DescribeVolumes                                     |
+---------+--------------------------------------------------------------------------------+
|  Cifrado|  True                                                                          |
|  Id     |  vol-0fb824c98c62e6cb2                                                         |
|  KMS    |  arn:aws:kms:us-east-1:264350941467:key/be643320-a452-4c1f-95b3-6574e133fdd6   |
+---------+--------------------------------------------------------------------------------+
```

**Cifrado de EBS por defecto en la cuenta**

```text
$ aws ec2 get-ebs-encryption-by-default --region us-east-1 --output table
------------------------------------
|     GetEbsEncryptionByDefault    |
+--------------------------+-------+
|  EbsEncryptionByDefault  |  True |
+--------------------------+-------+
```

**Políticas del rol de la EC2 (mínimo privilegio)**

```text
$ aws iam list-role-policies --role-name securenotes-demo-app --output table
---------------------------
|    ListRolePolicies     |
+-------------------------+
||      PolicyNames      ||
|+-----------------------+|
||  securenotes-runtime  ||
|+-----------------------+|
```

**Política de contraseñas de la cuenta (CIS)**

```text
$ aws iam get-account-password-policy --output table
------------------------------------------
|        GetAccountPasswordPolicy        |
+----------------------------------------+
||            PasswordPolicy            ||
|+------------------------------+-------+|
||  AllowUsersToChangePassword  |  True ||
||  ExpirePasswords             |  True ||
||  MaxPasswordAge              |  90   ||
||  MinimumPasswordLength       |  14   ||
||  PasswordReusePrevention     |  24   ||
||  RequireLowercaseCharacters  |  True ||
||  RequireNumbers              |  True ||
||  RequireSymbols              |  True ||
||  RequireUppercaseCharacters  |  True ||
|+------------------------------+-------+|
```

**Acceso por Session Manager (sin SSH)**

```text
$ aws ssm describe-instance-information --region us-east-1 --filters Key=InstanceIds,Values=i-048752feab5e38e63 --query InstanceInformationList[].{Id:InstanceId,Estado:PingStatus,Agente:AgentVersion} --output table
-------------------------------------------------
|          DescribeInstanceInformation          |
+-------------+---------+-----------------------+
|   Agente    | Estado  |          Id           |
+-------------+---------+-----------------------+
|  3.3.5700.0 |  Online |  i-048752feab5e38e63  |
+-------------+---------+-----------------------+
```


## 3. Cifrado en reposo y secretos

**CMK de KMS con rotación**

```text
$ aws kms get-key-rotation-status --region us-east-1 --key-id alias/securenotes-demo --output table

aws: [ERROR]: An error occurred (InvalidArnException) when calling the GetKeyRotationStatus operation: Key Aliases are not supported for this operation.
```

**Secretos en SSM como SecureString (solo metadatos, sin valores)**

```text
$ aws ssm describe-parameters --region us-east-1 --parameter-filters Key=Name,Option=BeginsWith,Values=/securenotes --query Parameters[].{Nombre:Name,Tipo:Type,KMS:KeyId} --output table
--------------------------------------------------------------------------------------------------------------------------------------
|                                                         DescribeParameters                                                         |
+------------------------------------------------------------------------------+-------------------------------------+---------------+
|                                      KMS                                     |               Nombre                |     Tipo      |
+------------------------------------------------------------------------------+-------------------------------------+---------------+
|  arn:aws:kms:us-east-1:264350941467:key/be643320-a452-4c1f-95b3-6574e133fdd6 |  /securenotes/admin_password        |  SecureString |
|  arn:aws:kms:us-east-1:264350941467:key/be643320-a452-4c1f-95b3-6574e133fdd6 |  /securenotes/db_password           |  SecureString |
|  arn:aws:kms:us-east-1:264350941467:key/be643320-a452-4c1f-95b3-6574e133fdd6 |  /securenotes/jwt_secret            |  SecureString |
|  arn:aws:kms:us-east-1:264350941467:key/be643320-a452-4c1f-95b3-6574e133fdd6 |  /securenotes/origin_verify_secret  |  SecureString |
+------------------------------------------------------------------------------+-------------------------------------+---------------+
```

**ECR inmutable, escaneo al publicar y cifrado KMS**

```text
$ aws ecr describe-repositories --region us-east-1 --query repositories[?starts_with(repositoryName, `securenotes`)].{Repo:repositoryName,Inmutable:imageTagMutability,Escaneo:imageScanningConfiguration.scanOnPush,Cifrado:encryptionConfiguration.encryptionType} --output table
----------------------------------------------------
|               DescribeRepositories               |
+---------+----------+-------------+---------------+
| Cifrado | Escaneo  |  Inmutable  |     Repo      |
+---------+----------+-------------+---------------+
|  KMS    |  True    |  IMMUTABLE  |  securenotes  |
+---------+----------+-------------+---------------+
```

**Log groups cifrados con KMS**

```text
$ aws logs describe-log-groups --region us-east-1 --log-group-name-prefix /securenotes --query logGroups[].{Nombre:logGroupName,KMS:kmsKeyId,Retencion:retentionInDays} --output table
------------------------------------------------------------------------------------------------------------------------------------
|                                                         DescribeLogGroups                                                        |
+------------------------------------------------------------------------------+--------------------------------------+------------+
|                                      KMS                                     |               Nombre                 | Retencion  |
+------------------------------------------------------------------------------+--------------------------------------+------------+
|  arn:aws:kms:us-east-1:264350941467:key/be643320-a452-4c1f-95b3-6574e133fdd6 |  /securenotes/app                    |  365       |
|  arn:aws:kms:us-east-1:264350941467:key/02c46e08-7c09-4174-87ac-e2eb4718a164 |  /securenotes/default-vpc-flow-logs  |  365       |
|  arn:aws:kms:us-east-1:264350941467:key/be643320-a452-4c1f-95b3-6574e133fdd6 |  /securenotes/vpc-flow-logs          |  365       |
+------------------------------------------------------------------------------+--------------------------------------+------------+
```


## 4. Monitoreo y detección

**CloudTrail (multirregión, validación de integridad, KMS)**

```text
$ aws cloudtrail describe-trails --region us-east-1 --query trailList[].{Nombre:Name,Multirregion:IsMultiRegionTrail,Validacion:LogFileValidationEnabled,KMS:KmsKeyId} --output table
-------------------------------------------------------------------------------------------------
|                                        DescribeTrails                                         |
+--------------+--------------------------------------------------------------------------------+
|  KMS         |  arn:aws:kms:us-east-1:264350941467:key/02c46e08-7c09-4174-87ac-e2eb4718a164   |
|  Multirregion|  True                                                                          |
|  Nombre      |  securenotes-org-trail                                                         |
|  Validacion  |  True                                                                          |
+--------------+--------------------------------------------------------------------------------+
```

**GuardDuty activo**

```text
$ aws guardduty list-detectors --region us-east-1 --output table

aws: [ERROR]: An error occurred (SubscriptionRequiredException) when calling the ListDetectors operation: The AWS Access Key Id needs a subscription for the service
```

**IAM Access Analyzer**

```text
$ aws accessanalyzer list-analyzers --region us-east-1 --query analyzers[].{Nombre:name,Tipo:type,Estado:status} --output table
-------------------------------------------------------
|                    ListAnalyzers                    |
+--------+--------------------------------+-----------+
| Estado |            Nombre              |   Tipo    |
+--------+--------------------------------+-----------+
|  ACTIVE|  securenotes-account-analyzer  |  ACCOUNT  |
+--------+--------------------------------+-----------+
```

**Alarmas de CloudWatch**

```text
$ aws cloudwatch describe-alarms --region us-east-1 --query MetricAlarms[].{Alarma:AlarmName,Estado:StateValue} --output table
-------------------------------------------------
|                DescribeAlarms                 |
+-------------------------------------+---------+
|               Alarma                | Estado  |
+-------------------------------------+---------+
|  cis-4.1-UnauthorizedApiCalls       |  OK     |
|  cis-4.10-SecurityGroupChanges      |  OK     |
|  cis-4.11-NaclChanges               |  OK     |
|  cis-4.12-NetworkGatewayChanges     |  OK     |
|  cis-4.13-RouteTableChanges         |  OK     |
|  cis-4.14-VpcChanges                |  OK     |
|  cis-4.15-OrganizationsChanges      |  OK     |
|  cis-4.2-ConsoleSigninWithoutMfa    |  OK     |
|  cis-4.3-RootAccountUsage           |  OK     |
|  cis-4.4-IamPolicyChanges           |  OK     |
|  cis-4.5-CloudTrailConfigChanges    |  OK     |
|  cis-4.6-ConsoleAuthFailures        |  OK     |
|  cis-4.7-KmsKeyDisableOrDeletion    |  OK     |
|  cis-4.8-S3BucketPolicyChanges      |  OK     |
|  cis-4.9-ConfigChanges              |  OK     |
|  securenotes-demo-LoginFailures     |  OK     |
|  securenotes-demo-SecurityEvents    |  OK     |
|  securenotes-demo-ServerErrors      |  OK     |
|  securenotes-demo-ec2-status-check  |  OK     |
|  securenotes-demo-rds-cpu           |  OK     |
+-------------------------------------+---------+
```

**WAF asociado a CloudFront**

```text
$ aws wafv2 list-web-acls --region us-east-1 --scope CLOUDFRONT --query WebACLs[].Name --output table
------------------------------
|         ListWebACLs        |
+----------------------------+
|  securenotes-demo-web-acl  |
+----------------------------+
```

