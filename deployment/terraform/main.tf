terraform {
  required_version = ">= 1.2.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.17"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.7"
    }
  }
}

provider "kubernetes" {
  config_path = "~/.kube/config"
}

resource "kubernetes_namespace" "stellarbridge" {
  metadata {
    name = "stellarbridge"
  }
}

module "postgres" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 4.0"

  engine            = "postgres"
  engine_version    = "15.2"
  instance_class    = "db.t3.micro"
  name              = "stellarbridge"
  username          = var.db_username
  password          = var.db_password
  allocated_storage = 20
  storage_type      = "gp2"
  skip_final_snapshot = true
  vpc_security_group_ids = [var.db_security_group_id]
  subnet_ids         = var.subnet_ids
}

# More resources for frontend and relayer deployment could be added here
