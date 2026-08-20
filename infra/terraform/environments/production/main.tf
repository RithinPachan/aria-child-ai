terraform {
  # Bootstrap note: create the remote state bucket once before enabling this block.
  # Keep production state isolated from staging state.
  backend "gcs" {
    prefix = "aria/production"
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
  environment          = "production"
  github_owner         = var.github_owner
  github_repository    = var.github_repository
  enable_vertex_memory = true
}
