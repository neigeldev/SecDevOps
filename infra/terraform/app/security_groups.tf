# Grupos de seguridad con mínimo privilegio de red:
#   Internet ──HTTPS──> CloudFront (+WAF) ──HTTP:80──> EC2 ──TLS:5432──> RDS
# No hay SSH: la administración se hace con AWS Systems Manager Session Manager.

# Rangos de IP de CloudFront hacia los orígenes (lista administrada por AWS)
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "web" {
  name        = "${local.name}-web"
  description = "EC2 de SecureNotes: solo acepta trafico de CloudFront"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-web" }
}

resource "aws_vpc_security_group_ingress_rule" "web_from_cloudfront" {
  #checkov:skip=CKV_AWS_260:Falso positivo: el origen es la lista de prefijos administrada de CloudFront, no 0.0.0.0/0.
  security_group_id = aws_security_group.web.id
  description       = "HTTP solo desde CloudFront"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

# Riesgo aceptado: sin NAT ni VPC endpoints (~USD 7/mes c/u) la EC2 necesita HTTPS saliente
# hacia los servicios de AWS (ECR, SSM, CloudWatch) y los repositorios de paquetes.
#trivy:ignore:AWS-0104
resource "aws_vpc_security_group_egress_rule" "web_https_out" {
  security_group_id = aws_security_group.web.id
  description       = "HTTPS saliente: ECR, SSM, CloudWatch y repositorios de paquetes"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "web_to_db" {
  security_group_id            = aws_security_group.web.id
  description                  = "PostgreSQL hacia RDS"
  referenced_security_group_id = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "RDS de SecureNotes: solo acepta conexiones de la EC2 de la app"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${local.name}-db" }
}

resource "aws_vpc_security_group_ingress_rule" "db_from_web" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL desde la app"
  referenced_security_group_id = aws_security_group.web.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}
