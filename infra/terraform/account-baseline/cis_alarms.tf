# Filtros de métricas y alarmas sobre CloudTrail (CIS AWS Foundations, sección 4)
locals {
  cis_metric_filters = {
    UnauthorizedApiCalls = {
      cis     = "4.1"
      desc    = "Llamadas a la API no autorizadas"
      pattern = "{ (($.errorCode = \"*UnauthorizedOperation\") || ($.errorCode = \"AccessDenied*\")) && ($.sourceIPAddress != \"delivery.logs.amazonaws.com\") && ($.eventName != \"HeadBucket\") }"
    }
    ConsoleSigninWithoutMfa = {
      cis     = "4.2"
      desc    = "Inicio de sesion en consola sin MFA"
      pattern = "{ ($.eventName = \"ConsoleLogin\") && ($.additionalEventData.MFAUsed != \"Yes\") && ($.userIdentity.type = \"IAMUser\") && ($.responseElements.ConsoleLogin = \"Success\") }"
    }
    RootAccountUsage = {
      cis     = "4.3"
      desc    = "Uso de la cuenta raiz"
      pattern = "{ $.userIdentity.type = \"Root\" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != \"AwsServiceEvent\" }"
    }
    IamPolicyChanges = {
      cis     = "4.4"
      desc    = "Cambios en politicas IAM"
      pattern = "{ ($.eventName = DeleteGroupPolicy) || ($.eventName = DeleteRolePolicy) || ($.eventName = DeleteUserPolicy) || ($.eventName = PutGroupPolicy) || ($.eventName = PutRolePolicy) || ($.eventName = PutUserPolicy) || ($.eventName = CreatePolicy) || ($.eventName = DeletePolicy) || ($.eventName = CreatePolicyVersion) || ($.eventName = DeletePolicyVersion) || ($.eventName = AttachRolePolicy) || ($.eventName = DetachRolePolicy) || ($.eventName = AttachUserPolicy) || ($.eventName = DetachUserPolicy) || ($.eventName = AttachGroupPolicy) || ($.eventName = DetachGroupPolicy) }"
    }
    CloudTrailConfigChanges = {
      cis     = "4.5"
      desc    = "Cambios en la configuracion de CloudTrail"
      pattern = "{ ($.eventName = CreateTrail) || ($.eventName = UpdateTrail) || ($.eventName = DeleteTrail) || ($.eventName = StartLogging) || ($.eventName = StopLogging) }"
    }
    ConsoleAuthFailures = {
      cis     = "4.6"
      desc    = "Fallos de autenticacion en la consola"
      pattern = "{ ($.eventName = ConsoleLogin) && ($.errorMessage = \"Failed authentication\") }"
    }
    KmsKeyDisableOrDeletion = {
      cis     = "4.7"
      desc    = "Deshabilitacion o borrado programado de claves KMS"
      pattern = "{ ($.eventSource = kms.amazonaws.com) && (($.eventName = DisableKey) || ($.eventName = ScheduleKeyDeletion)) }"
    }
    S3BucketPolicyChanges = {
      cis     = "4.8"
      desc    = "Cambios en politicas de buckets S3"
      pattern = "{ ($.eventSource = s3.amazonaws.com) && (($.eventName = PutBucketAcl) || ($.eventName = PutBucketPolicy) || ($.eventName = PutBucketCors) || ($.eventName = PutBucketLifecycle) || ($.eventName = PutBucketReplication) || ($.eventName = DeleteBucketPolicy) || ($.eventName = DeleteBucketCors) || ($.eventName = DeleteBucketLifecycle) || ($.eventName = DeleteBucketReplication)) }"
    }
    ConfigChanges = {
      cis     = "4.9"
      desc    = "Cambios en AWS Config"
      pattern = "{ ($.eventSource = config.amazonaws.com) && (($.eventName = StopConfigurationRecorder) || ($.eventName = DeleteDeliveryChannel) || ($.eventName = PutDeliveryChannel) || ($.eventName = PutConfigurationRecorder)) }"
    }
    SecurityGroupChanges = {
      cis     = "4.10"
      desc    = "Cambios en grupos de seguridad"
      pattern = "{ ($.eventName = AuthorizeSecurityGroupIngress) || ($.eventName = AuthorizeSecurityGroupEgress) || ($.eventName = RevokeSecurityGroupIngress) || ($.eventName = RevokeSecurityGroupEgress) || ($.eventName = CreateSecurityGroup) || ($.eventName = DeleteSecurityGroup) }"
    }
    NaclChanges = {
      cis     = "4.11"
      desc    = "Cambios en NACL"
      pattern = "{ ($.eventName = CreateNetworkAcl) || ($.eventName = CreateNetworkAclEntry) || ($.eventName = DeleteNetworkAcl) || ($.eventName = DeleteNetworkAclEntry) || ($.eventName = ReplaceNetworkAclEntry) || ($.eventName = ReplaceNetworkAclAssociation) }"
    }
    NetworkGatewayChanges = {
      cis     = "4.12"
      desc    = "Cambios en gateways de red"
      pattern = "{ ($.eventName = CreateCustomerGateway) || ($.eventName = DeleteCustomerGateway) || ($.eventName = AttachInternetGateway) || ($.eventName = CreateInternetGateway) || ($.eventName = DeleteInternetGateway) || ($.eventName = DetachInternetGateway) }"
    }
    RouteTableChanges = {
      cis     = "4.13"
      desc    = "Cambios en tablas de rutas"
      pattern = "{ ($.eventSource = ec2.amazonaws.com) && (($.eventName = CreateRoute) || ($.eventName = CreateRouteTable) || ($.eventName = ReplaceRoute) || ($.eventName = ReplaceRouteTableAssociation) || ($.eventName = DeleteRouteTable) || ($.eventName = DeleteRoute) || ($.eventName = DisassociateRouteTable)) }"
    }
    VpcChanges = {
      cis     = "4.14"
      desc    = "Cambios en VPC"
      pattern = "{ ($.eventName = CreateVpc) || ($.eventName = DeleteVpc) || ($.eventName = ModifyVpcAttribute) || ($.eventName = AcceptVpcPeeringConnection) || ($.eventName = CreateVpcPeeringConnection) || ($.eventName = DeleteVpcPeeringConnection) || ($.eventName = RejectVpcPeeringConnection) || ($.eventName = AttachClassicLinkVpc) || ($.eventName = DetachClassicLinkVpc) || ($.eventName = DisableVpcClassicLink) || ($.eventName = EnableVpcClassicLink) }"
    }
    OrganizationsChanges = {
      cis     = "4.15"
      desc    = "Cambios en AWS Organizations"
      pattern = "{ ($.eventSource = organizations.amazonaws.com) && (($.eventName = \"AcceptHandshake\") || ($.eventName = \"AttachPolicy\") || ($.eventName = \"CreateAccount\") || ($.eventName = \"CreateOrganizationalUnit\") || ($.eventName = \"CreatePolicy\") || ($.eventName = \"DeclineHandshake\") || ($.eventName = \"DeleteOrganization\") || ($.eventName = \"DeleteOrganizationalUnit\") || ($.eventName = \"DeletePolicy\") || ($.eventName = \"DetachPolicy\") || ($.eventName = \"DisablePolicyType\") || ($.eventName = \"EnablePolicyType\") || ($.eventName = \"InviteAccountToOrganization\") || ($.eventName = \"LeaveOrganization\") || ($.eventName = \"MoveAccount\") || ($.eventName = \"RemoveAccountFromOrganization\") || ($.eventName = \"UpdatePolicy\") || ($.eventName = \"UpdateOrganizationalUnit\")) }"
    }
  }
}

resource "aws_cloudwatch_log_metric_filter" "cis" {
  for_each       = local.cis_metric_filters
  name           = "cis-${each.value.cis}-${each.key}"
  log_group_name = aws_cloudwatch_log_group.trail.name
  pattern        = each.value.pattern

  metric_transformation {
    name      = each.key
    namespace = "CISBenchmark"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "cis" {
  for_each            = local.cis_metric_filters
  alarm_name          = "cis-${each.value.cis}-${each.key}"
  alarm_description   = "CIS ${each.value.cis}: ${each.value.desc}"
  namespace           = "CISBenchmark"
  metric_name         = each.key
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.security.arn]
  depends_on          = [aws_cloudwatch_log_metric_filter.cis]
}
