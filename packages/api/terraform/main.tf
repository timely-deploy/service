variable "cloudflare_zone" {}
variable "api_hostname" {}

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 2.3"
    }
  }

  required_version = ">= 0.13"

  backend "s3" {
    bucket  = "timely-deploy-service-tf-state"
    key     = "api/terraform.tfstate"
    region  = "us-west-2"
    encrypt = true
  }
}

resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone
  name    = var.api_hostname
  value   = "192.2.0.1"
  type    = "A"
  proxied = true
}
