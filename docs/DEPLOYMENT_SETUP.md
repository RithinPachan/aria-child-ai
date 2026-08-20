# ARIA Deployment and CI/CD Setup

This guide activates the repository’s independently deployable release pipelines. It uses one GitHub monorepo with path-aware automation: a change to `services/gateway` deploys only the Gateway, while a change to `apps/aria-face-app` updates only the Face App. This provides independent operational releases without prematurely splitting tightly coupled code into many repositories.

## Release Components

| Component | Source path | Artifact | Staging action | Production action |
|---|---|---|---|---|
| Gateway | `services/gateway/` | Container image | Cloud Run `aria-gateway-staging` | Approved promotion to `aria-gateway` |
| Memory | `services/memory/` | Container image | Cloud Run `aria-memory-staging` | Approved promotion to `aria-memory` |
| Guardrails | `services/guardrails/` | Container image | Cloud Run `aria-guardrails-staging` | Approved promotion to `aria-guardrails` |
| Face App | `apps/aria-face-app/` | EAS update/build | Expo `preview` channel | Approved signed EAS production build |
| Parent Dashboard | `apps/parent-dashboard/` | EAS update/build | Expo `preview` channel | Approved signed EAS production build |
| Edge Runtime | `packages/hal/` | Signed, attested archive | GitHub artifact only | Device rollout is deliberately deferred |

The central component catalog is `deployment/components.yaml`. Update it whenever a component’s deployable boundary, health endpoint, or scaling policy changes.

## One-Time GCP Bootstrap

Create **separate GCP projects** for staging and production. A child-facing service must not share a production project, database, service account, or encryption boundary with testing workloads.

From `infra/terraform/environments/staging`, create a secure `terraform.tfvars` file that is never committed:

`project_id        = "your-aria-staging-project"`
`region            = "us-central1"`
`github_owner      = "RithinPachan"`
`github_repository = "aria-child-ai"`

Run `terraform init`, `terraform plan`, and `terraform apply`. Repeat from `infra/terraform/environments/production` with the production project values. Before switching Terraform state to GCS, create the dedicated state bucket manually, enable versioning and uniform bucket-level access, and set the correct bucket name in the backend configuration. Do not store application credentials or Terraform state in GitHub.

The Terraform module provisions Artifact Registry, least-privilege runtime service accounts, Secret Manager placeholders, and GitHub OpenID Connect federation. It intentionally does **not** place secret values into Terraform state.

## GitHub Environments

Create two GitHub Environments: `staging` and `production`. Add a required reviewer to `production`; the account used for ordinary development should not be able to approve its own production release. Set environment-level protection to allow only the `main` branch.

Add these repository or environment secrets after the Terraform outputs are available:

| Secret | Source | Purpose |
|---|---|---|
| `GCP_PROJECT_ID` | Your GCP project ID | Artifact Registry and Cloud Run target. Use an environment-specific value. |
| `GCP_WIF_PROVIDER` | Terraform output `workload_identity_provider` | GitHub OIDC trust provider. |
| `GCP_DEPLOYER_SERVICE_ACCOUNT` | Terraform output `github_deployer_service_account` | Short-lived CI deployment identity. |
| `EXPO_TOKEN` | Expo account access token | EAS preview updates and requested builds. |

Add these repository variables, which are configuration rather than credentials:

| Variable | Example | Purpose |
|---|---|---|
| `GCP_REGION` | `us-central1` | Primary deployment region. |
| `EXPO_STAGING_GATEWAY_URL` | `wss://gateway-staging.example.com/ws/audio` | Face App staging gateway address. |
| `EXPO_PRODUCTION_GATEWAY_URL` | `wss://gateway.example.com/ws/audio` | Face App production gateway address. |

## Runtime Secrets

Put secret values directly into Google Secret Manager. Examples include the Gateway JWT verification key, Gemini configuration, and parent-alert provider configuration. Grant access only to the individual runtime service account that needs each secret. Never put these values in a GitHub secret, `.env` file committed to the repository, mobile application bundle, Docker image, or Terraform variable.

The Gateway is the only component reachable from a mobile device. It validates a short-lived JWT at the WebSocket boundary, applies connection limits, and communicates with the private Memory and Guardrails services. All internal services should remain Cloud Run IAM-protected.

## Release Flow

A pull request runs formatting, TypeScript and Python checks, tests, dependency review, secret scanning, container vulnerability scanning, and Terraform validation. A merge to `main` builds immutable container images, deploys only changed services to staging, and publishes only changed mobile applications to the Expo preview channel. A production Cloud Run release is intentionally manual: run **Promote Service to Production**, choose the component, provide the already-validated immutable image SHA, and provide a semantic version. GitHub Environment approval is required before deployment.

The edge artifact workflow validates and attests the hardware abstraction package. It does not automatically update devices. Before physical deployment, introduce a dedicated device management service with certificate-based device identity, staged rollout groups, rollback telemetry, and a human-approved rollout gate.

## Branch Rules

After the workflow-enabled commit reaches GitHub, protect `main` with required checks: `JavaScript quality gates`, each applicable service quality job, `Dependency review`, `Secret scan`, and `Terraform validation`. Require pull requests, require resolved conversations, block force pushes, and require linear history. Disable direct production changes from local machines.

## Local Verification

The validated local commands are:

`pnpm format:check`
`pnpm lint`
`pnpm typecheck`
`cd services/gateway && pytest tests -q`
`cd services/guardrails && pytest tests -q`

Use `docker compose --env-file .env.local up --build` only with local non-production secrets. The provided compose file keeps the Memory and Guardrails services on an internal network and exposes the Gateway only for local mobile testing.
