# Instancia de la aplicación (Amazon Linux 2023 + Docker)
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-6.*-x86_64"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "aws_instance" "app" {
  #checkov:skip=CKV_AWS_88:Necesita IP pública para salir a Internet sin NAT Gateway (USD ~32/mes). El grupo de seguridad solo admite tráfico de CloudFront y la app exige el encabezado secreto de origen.
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.web.id]
  iam_instance_profile        = aws_iam_instance_profile.app.name
  associate_public_ip_address = true
  monitoring                  = true
  ebs_optimized               = true

  # IMDSv2 obligatorio; hop limit 1 impide que los contenedores lean credenciales del host
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    encrypted             = true
    kms_key_id            = aws_kms_key.main.arn
    delete_on_termination = true
  }

  # Sin secretos en user_data: solo nombres de parámetros SSM
  user_data = templatefile("${path.module}/templates/user_data.sh.tftpl", {
    region       = local.region
    registry     = split("/", aws_ecr_repository.app.repository_url)[0]
    image        = local.image
    log_group    = aws_cloudwatch_log_group.app.name
    ssm_prefix   = local.ssm_prefix
    db_host      = aws_db_instance.main.address
    db_user      = aws_db_instance.main.username
    db_name      = aws_db_instance.main.db_name
    project_name = var.project
  })
  user_data_replace_on_change = true

  tags = { Name = "${local.name}-app" }

  lifecycle {
    ignore_changes = [ami]
  }

  depends_on = [
    aws_ssm_parameter.db_password,
    aws_ssm_parameter.jwt_secret,
    aws_ssm_parameter.admin_password,
    aws_ssm_parameter.origin_verify,
  ]
}
