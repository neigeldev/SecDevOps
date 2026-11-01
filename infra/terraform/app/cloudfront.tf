# CloudFront como única puerta de entrada pública:
# - HTTPS obligatorio para el usuario (certificado *.cloudfront.net)
# - WAF con reglas administradas (opcional, activado por defecto)
# - Encabezado secreto hacia el origen (la app rechaza peticiones sin él)
# - Política administrada de encabezados de seguridad
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

data "aws_cloudfront_response_headers_policy" "security" {
  name = "Managed-SecurityHeadersPolicy"
}

# Riesgo aceptado (ver CKV_AWS_86): registros cubiertos por WAF y la app en CloudWatch.
#trivy:ignore:AWS-0010
resource "aws_cloudfront_distribution" "app" {
  #checkov:skip=CKV_AWS_174:Sin dominio propio se usa el certificado por defecto *.cloudfront.net, que no permite fijar TLSv1.2_2021. Con dominio + ACM se fija minimum_protocol_version.
  #checkov:skip=CKV2_AWS_42:Requiere dominio propio y certificado ACM (ver CKV_AWS_174).
  #checkov:skip=CKV_AWS_86:Los registros de acceso se cubren con los logs de WAF y de la app en CloudWatch.
  #checkov:skip=CKV_AWS_310:Un solo origen; no se configura failover para el entorno académico.
  #checkov:skip=CKV_AWS_374:Sin restricción geográfica: la app no tiene requisito de residencia.
  #checkov:skip=CKV2_AWS_32:Se usa la política administrada Managed-SecurityHeadersPolicy (Checkov no resuelve data sources).
  #checkov:skip=CKV_AWS_305:La raíz la sirve el origen (no es un bucket S3).
  #checkov:skip=CKV2_AWS_46:El origen es una EC2, no un bucket S3.
  #checkov:skip=CKV2_AWS_47:El WebACL asociado (waf.tf) sí incluye KnownBadInputs/Log4j (CKV_AWS_192 pasa); el chequeo de grafo no resuelve el web_acl_id condicional.
  enabled             = true
  comment             = "${local.name}: SecureNotes"
  price_class         = "PriceClass_100"
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  wait_for_deployment = true
  web_acl_id          = var.enable_waf ? aws_wafv2_web_acl.app[0].arn : null

  origin {
    domain_name = aws_instance.app.public_dns
    origin_id   = "ec2-app"

    # Sin dominio propio la EC2 no puede tener un certificado público válido, por lo
    # que el tramo CloudFront->origen va por HTTP dentro de la red de AWS. Mitigado
    # con: SG restringido a CloudFront + encabezado secreto + sin datos sensibles en URL.
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 30
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.origin_verify.result
    }
  }

  default_cache_behavior {
    target_origin_id           = "ec2-app"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
