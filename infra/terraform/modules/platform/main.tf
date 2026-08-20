locals {
  required_apis = toset([
    "artifactregistry.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "logging.googleapis.com",
    "cloudtrace.googleapis.com",
    "firestore.googleapis.com"
  ])

  service_names = toset(["gateway", "memory", "guardrails"])
}

resource "google_project_service" "required" {
  for_each           = local.required_apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = "aria"
  description   = "Immutable ARIA container images for ${var.environment} promotion"
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "runtime" {
  for_each     = local.service_names
  project      = var.project_id
  account_id   = "aria-${each.key}-${var.environment}"
  display_name = "ARIA ${each.key} runtime (${var.environment})"
  description  = "Least-privilege Cloud Run identity for ARIA ${each.key} in ${var.environment}."
}

resource "google_project_iam_member" "runtime_logging" {
  for_each = google_service_account.runtime
  project  = var.project_id
  role     = "roles/logging.logWriter"
  member   = "serviceAccount:${each.value.email}"
}

resource "google_project_iam_member" "memory_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime["memory"].email}"
}

resource "google_project_iam_member" "memory_vertex" {
  count   = var.enable_vertex_memory ? 1 : 0
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.runtime["memory"].email}"
}

resource "google_project_iam_member" "gateway_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.runtime["gateway"].email}"
}

resource "google_secret_manager_secret" "application_secrets" {
  for_each = toset([
    "aria-gateway-jwt-public-key-${var.environment}",
    "aria-gemini-config-${var.environment}",
    "aria-notification-config-${var.environment}"
  ])

  project   = var.project_id
  secret_id = each.value
  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "runtime_access" {
  for_each = {
    gateway_jwt = {
      secret_id = google_secret_manager_secret.application_secrets["aria-gateway-jwt-public-key-${var.environment}"].secret_id
      member    = google_service_account.runtime["gateway"].email
    }
    gateway_gemini = {
      secret_id = google_secret_manager_secret.application_secrets["aria-gemini-config-${var.environment}"].secret_id
      member    = google_service_account.runtime["gateway"].email
    }
    guardrails_notifications = {
      secret_id = google_secret_manager_secret.application_secrets["aria-notification-config-${var.environment}"].secret_id
      member    = google_service_account.runtime["guardrails"].email
    }
  }

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.value.member}"
}

resource "google_service_account" "github_deployer" {
  project      = var.project_id
  account_id   = "aria-github-deployer-${var.environment}"
  display_name = "ARIA GitHub Actions deployer (${var.environment})"
}

resource "google_project_iam_member" "github_deployer_roles" {
  for_each = toset([
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser"
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_deployer.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "aria-github-${var.environment}"
  display_name              = "ARIA GitHub Actions ${var.environment}"
  description               = "OIDC trust boundary for approved ARIA GitHub workflows."
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub Actions OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == '${var.github_owner}/${var.github_repository}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.github_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_owner}/${var.github_repository}"
}
