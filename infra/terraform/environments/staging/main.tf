terraform {
  # Bootstrap note: create the remote state bucket once before enabling this block.
  # Until then, run `terraform init -backend=false` for validate-only checks.
  backend "gcs" {
    prefix = "aria/staging"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "platform" {
  source = "../../modules/platform"

  project_id           = var.project_id
  region               = var.region
  environment          = "staging"
  github_owner         = var.github_owner
  github_repository    = var.github_repository
  enable_vertex_memory = false
}
