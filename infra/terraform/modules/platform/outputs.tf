output "artifact_registry_repository" {
  description = "Artifact Registry Docker repository path."
  value       = google_artifact_registry_repository.containers.name
}

output "github_deployer_service_account" {
  description = "Email of the least-privilege GitHub Actions deployment account."
  value       = google_service_account.github_deployer.email
}

output "workload_identity_provider" {
  description = "Full OIDC workload identity provider resource used in GitHub Actions."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "runtime_service_accounts" {
  description = "Runtime identities keyed by component."
  value = {
    for name, account in google_service_account.runtime : name => account.email
  }
}
