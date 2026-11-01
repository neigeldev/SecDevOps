terraform {
  # 1.11+ es necesario para recursos efímeros y argumentos de solo escritura
  # (los secretos no quedan guardados en el archivo de estado).
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  # Recomendado para equipos: estado remoto cifrado y con bloqueo.
  # backend "s3" {
  #   bucket       = "<tu-bucket-de-estado>"
  #   key          = "securenotes/app.tfstate"
  #   region       = "us-east-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}
