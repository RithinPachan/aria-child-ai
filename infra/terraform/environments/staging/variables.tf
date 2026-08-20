variable "project_id" {
  description = "Dedicated Google Cloud project ID for ARIA staging."
  type        = string
}

variable "region" {
  description = "Primary regional deployment location."
  type        = string
  default     = "us-central1"
}

variable "github_owner" {
  description = "GitHub account or organization name."
  type        = string
}

variable "github_repository" {
  description = "ARIA repository name, excluding the owner."
  type        = string
}
