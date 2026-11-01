# Registro privado de la imagen de la app
resource "aws_ecr_repository" "app" {
  name                 = var.project
  image_tag_mutability = "IMMUTABLE" # una etiqueta publicada no se puede sobrescribir
  force_delete         = true        # permite destruir el entorno de demostración

  image_scanning_configuration {
    scan_on_push = true # escaneo de vulnerabilidades de ECR al publicar
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn
  }
}

# Conserva solo las últimas 10 imágenes
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Conservar las ultimas 10 imagenes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
