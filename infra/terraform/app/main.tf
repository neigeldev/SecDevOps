provider "aws" {
  region = var.region

  # Etiquetas obligatorias en todos los recursos (gobierno y costos)
  default_tags {
    tags = local.tags
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_region" "current" {}

locals {
  name       = "${var.project}-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
  partition  = data.aws_partition.current.partition
  region     = data.aws_region.current.region
  azs        = var.availability_zones

  tags = {
    Project     = var.project
    Environment = var.environment
    Owner       = var.owner
    ManagedBy   = "terraform"
    Module      = "M2-M3-securenotes-app"
  }

  ssm_prefix = "/${var.project}"
  image      = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
}
