#!/usr/bin/env bash
# Bootstrap the ARIA cloud foundation without deploying workloads or storing secrets.
# Usage:
#   ./scripts/bootstrap_gcp_foundation.sh <project-id> <staging|production> <region> <github-owner> <github-repository>
set -Eeuo pipefail

PROJECT_ID="${1:?project ID is required}"
ENVIRONMENT="${2:?environment is required: staging or production}"
REGION="${3:-us-central1}"
GITHUB_OWNER="${4:?GitHub owner is required}"
GITHUB_REPOSITORY="${5:?GitHub repository is required}"

if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
  echo "Environment must be staging or production." >&2
  exit 2
fi

if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Project $PROJECT_ID does not exist or the current account has insufficient access." >&2
  exit 3
fi

BILLING_ENABLED="$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)')"
if [[ "$BILLING_ENABLED" != "True" ]]; then
  echo "Billing is not enabled for $PROJECT_ID; aborting." >&2
  exit 4
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
REPOSITORY="${GITHUB_OWNER}/${GITHUB_REPOSITORY}"
POOL_ID="aria-github-${ENVIRONMENT}"
PROVIDER_ID="github"
DEPLOYER_ID="aria-github-deployer-${ENVIRONMENT}"
DEPLOYER_EMAIL="${DEPLOYER_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

APIS=(
  artifactregistry.googleapis.com
  run.googleapis.com
  secretmanager.googleapis.com
  iamcredentials.googleapis.com
  sts.googleapis.com
  cloudresourcemanager.googleapis.com
  logging.googleapis.com
  cloudtrace.googleapis.com
  firestore.googleapis.com
  aiplatform.googleapis.com
)

SERVICE_NAMES=(gateway memory guardrails)
SECRETS=(
  "aria-gateway-jwt-public-key-${ENVIRONMENT}"
  "aria-gemini-config-${ENVIRONMENT}"
  "aria-notification-config-${ENVIRONMENT}"
)

printf '\n==> Enabling required APIs in %s\n' "$PROJECT_ID"
gcloud services enable "${APIS[@]}" --project="$PROJECT_ID" --quiet

printf '\n==> Creating immutable container registry\n'
if ! gcloud artifacts repositories describe aria --project="$PROJECT_ID" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create aria \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --repository-format=docker \
    --description="Immutable ARIA container images for ${ENVIRONMENT} promotion" \
    --quiet
fi

printf '\n==> Creating least-privilege Cloud Run runtime identities\n'
for service in "${SERVICE_NAMES[@]}"; do
  service_account="aria-${service}-${ENVIRONMENT}"
  service_email="${service_account}@${PROJECT_ID}.iam.gserviceaccount.com"
  if ! gcloud iam service-accounts describe "$service_email" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$service_account" \
      --project="$PROJECT_ID" \
      --display-name="ARIA ${service} runtime (${ENVIRONMENT})" \
      --description="Least-privilege Cloud Run identity for ARIA ${service} in ${ENVIRONMENT}." \
      --quiet
  fi
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${service_email}" \
    --role="roles/logging.logWriter" \
    --quiet >/dev/null

done

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:aria-gateway-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user" \
  --quiet >/dev/null

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:aria-memory-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user" \
  --quiet >/dev/null

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:aria-memory-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user" \
  --quiet >/dev/null

printf '\n==> Creating empty Secret Manager placeholders (no secret values)\n'
for secret_id in "${SECRETS[@]}"; do
  if ! gcloud secrets describe "$secret_id" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret_id" \
      --project="$PROJECT_ID" \
      --replication-policy=automatic \
      --labels="application=aria,environment=${ENVIRONMENT}" \
      --quiet
  fi
done

gcloud secrets add-iam-policy-binding "aria-gateway-jwt-public-key-${ENVIRONMENT}" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:aria-gateway-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null
gcloud secrets add-iam-policy-binding "aria-gemini-config-${ENVIRONMENT}" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:aria-gateway-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null
gcloud secrets add-iam-policy-binding "aria-notification-config-${ENVIRONMENT}" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:aria-guardrails-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null

printf '\n==> Creating keyless GitHub Actions deployer identity\n'
if ! gcloud iam service-accounts describe "$DEPLOYER_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$DEPLOYER_ID" \
    --project="$PROJECT_ID" \
    --display-name="ARIA GitHub Actions deployer (${ENVIRONMENT})" \
    --description="Keyless OIDC deployment identity for approved ARIA GitHub workflows." \
    --quiet
fi

for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER_EMAIL}" \
    --role="$role" \
    --quiet >/dev/null
done

if ! gcloud iam workload-identity-pools describe "$POOL_ID" --project="$PROJECT_ID" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --project="$PROJECT_ID" \
    --location=global \
    --display-name="ARIA GitHub Actions ${ENVIRONMENT}" \
    --description="OIDC trust boundary for approved ARIA GitHub Actions workflows." \
    --quiet
fi

if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" --project="$PROJECT_ID" --location=global --workload-identity-pool="$POOL_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --project="$PROJECT_ID" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub Actions OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${REPOSITORY}'" \
    --quiet
fi

POOL_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${REPOSITORY}" \
  --quiet >/dev/null

PROVIDER_NAME="${POOL_NAME}/providers/${PROVIDER_ID}"

printf '\n==> Foundation bootstrap complete for %s\n' "$PROJECT_ID"
printf 'GCP_PROJECT_ID=%s\n' "$PROJECT_ID"
printf 'GCP_WIF_PROVIDER=%s\n' "$PROVIDER_NAME"
printf 'GCP_DEPLOYER_SERVICE_ACCOUNT=%s\n' "$DEPLOYER_EMAIL"
printf 'ARTIFACT_REGISTRY=%s-docker.pkg.dev/%s/aria\n' "$REGION" "$PROJECT_ID"
