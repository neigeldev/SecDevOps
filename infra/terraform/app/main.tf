terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "db_password" {
  default = "postgres"
}

data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "web" {
  name        = "securenotes-web"
  description = "Acceso a SecureNotes"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "web" {
  name = "securenotes-web"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "web" {
  name = "securenotes-web"
  role = aws_iam_role.web.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "*"
      Resource = "*"
    }]
  })
}

resource "aws_iam_instance_profile" "web" {
  name = "securenotes-web"
  role = aws_iam_role.web.name
}

resource "aws_instance" "web" {
  ami                         = "ami-0c02fb55956c7d316"
  instance_type               = "t2.micro"
  key_name                    = "securenotes-key"
  vpc_security_group_ids      = [aws_security_group.web.id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.web.name

  root_block_device {
    volume_size = 20
    encrypted   = false
  }

  user_data = <<-EOF
    #!/bin/bash
    yum install -y docker git
    service docker start
    docker run -d --name db -p 5432:5432 -e POSTGRES_PASSWORD=${var.db_password} -e POSTGRES_DB=securenotes postgres:latest
    git clone https://github.com/neigeldev/SecDevOps.git /opt/securenotes
    cd /opt/securenotes/app && docker build -t securenotes .
    docker run -d --name app -p 3000:3000 --link db -e DB_HOST=db securenotes
  EOF

  tags = {
    Name = "securenotes"
  }
}

resource "aws_s3_bucket" "backups" {
  bucket = "securenotes-backups"
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "backups" {
  bucket = aws_s3_bucket.backups.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.backups.arn}/*"
    }]
  })
}

output "public_ip" {
  value = aws_instance.web.public_ip
}

output "url" {
  value = "http://${aws_instance.web.public_ip}:3000"
}
