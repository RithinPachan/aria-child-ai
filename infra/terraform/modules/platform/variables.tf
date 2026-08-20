variable "project_id" {
  description = "Google Cloud project ID receiving the ARIA environment."
  type        = string
}

variable "region" {
  description = "Google Cloud region for Cloud Run and Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "github_owner" {
  description = "GitHub user or organization owning the ARIA repository."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository name, without the owner prefix."
  type        = string
}

variable "enable_vertex_memory" {
  description = "Grant the memory runtime access to Vertex AI Vector Search. Enable only after the vector index is provisioned."
  type        = bool
  default     = false
}
