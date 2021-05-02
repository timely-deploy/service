variable "api_hostname" {}
variable "app_name" {}
variable "cloudflare_zone" {}
variable "github_app_id" {}
variable "github_app_private_key" {}
variable "github_webhook_secret" {}
variable "logflare_api_key" {}
variable "release_version" {}
variable "sentry_dsn" {}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.2.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 2.3"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 2.1.2"
    }
  }

  required_version = ">= 0.13"

  backend "s3" {
    bucket  = "timely-deploy-service-tf-state"
    key     = "worker-api/terraform.tfstate"
    region  = "us-west-2"
    encrypt = true
  }
}

resource "cloudflare_worker_script" "worker" {
  name    = "timely-deploy-api-${terraform.workspace}"
  content = file("../bundle/worker.js")

  plain_text_binding {
    name = "WORKSPACE"
    text = terraform.workspace
  }

  plain_text_binding {
    name = "APP_NAME"
    text = var.app_name
  }

  plain_text_binding {
    name = "RELEASE_VERSION"
    text = var.release_version
  }

  plain_text_binding {
    name = "GITHUB_APP_ID"
    text = var.github_app_id
  }

  secret_text_binding {
    name = "GITHUB_APP_PRIVATE_KEY"
    text = var.github_app_private_key
  }

  secret_text_binding {
    name = "GITHUB_WEBHOOK_SECRET"
    text = var.github_webhook_secret
  }

  secret_text_binding {
    name = "LOGFLARE_API_KEY"
    text = var.logflare_api_key
  }

  secret_text_binding {
    name = "SENTRY_DSN"
    text = var.sentry_dsn
  }
}

resource "cloudflare_worker_route" "route" {
  zone_id     = var.cloudflare_zone
  pattern     = "${var.api_hostname}/*"
  script_name = cloudflare_worker_script.worker.name
}
