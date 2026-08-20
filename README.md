# ARIA: Adaptive Responsive Intelligence for Attachment

ARIA is a next-generation, child-friendly AI companion system designed to be superior to existing products like Miko. It features sub-500ms voice interaction latency via Google Cloud Gemini Live API, a three-tier memory architecture, and a rigorous three-layer child safety guardrail system.

This repository is a production-grade monorepo containing all software components required to run ARIA as a mobile app (Phase 1) and as a physical robot (Phase 2).

## Repository Architecture

The codebase is structured as a pnpm workspace (monorepo) to share types, configurations, and hardware abstraction layers across all applications and microservices.

| Directory                | Component                      | Description                                                                                  |
| ------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------- |
| `apps/aria-face-app/`    | **ARIA Face App**              | React Native/Expo app displaying the animated robot face and handling voice I/O.             |
| `apps/parent-dashboard/` | **Parent Dashboard**           | React Native/Expo app for parents to monitor sessions, manage safety, and view insights.     |
| `services/gateway/`      | **Cloud Gateway**              | Python FastAPI WebSocket server relaying audio between the device and Gemini Live API.       |
| `services/memory/`       | **Memory Service**             | Python FastAPI service managing Redis session state and Firestore persistent profiles.       |
| `services/guardrails/`   | **Guardrails Service**         | Python FastAPI service providing PII redaction, topic blocking, and crisis detection.        |
| `packages/hal/`          | **Hardware Abstraction Layer** | TypeScript interfaces and implementations allowing the app to run on phones or Raspberry Pi. |
| `packages/shared-types/` | **Shared Types**               | TypeScript definitions shared between the frontend apps and the Node.js tooling.             |

## Quick Start (Development)

### Prerequisites

- Node.js 22+ and pnpm 9+
- Python 3.12+
- Docker and Docker Compose
- Google Cloud SDK (`gcloud`) authenticated to your GCP project

### 1. Install Dependencies

Navigate to the root directory and install all Node.js dependencies:
`pnpm install`

### 2. Start Local Infrastructure

Start the local Redis instance required by the Memory service:
`docker-compose up -d redis`
_(Note: Create a `docker-compose.yml` in the root if you prefer local containerized databases)_

### 3. Run the Microservices

In separate terminal windows, navigate to each service directory, install Python dependencies, and start the servers:

**Gateway Service (Port 8000):**
`cd services/gateway`
`pip install -e ".[dev]"`
`uvicorn src.main:app --reload --port 8000`

**Memory Service (Port 8001):**
`cd services/memory`
`pip install -e ".[dev]"`
`uvicorn src.main:app --reload --port 8001`

**Guardrails Service (Port 8002):**
`cd services/guardrails`
`pip install -e ".[dev]"`
`uvicorn src.main:app --reload --port 8002`

### 4. Run the Mobile Apps

In a new terminal, start the Expo development server for the ARIA Face App:
`cd apps/aria-face-app`
`pnpm start`

Use the Expo Go app on your physical device (recommended for microphone access) or an iOS/Android emulator to open the app.

## Hardware Abstraction Layer (HAL)

The `packages/hal` directory is the secret to ARIA's portability. The Face App never calls device APIs directly. Instead, it uses the HAL registry:

`import { HALRegistry } from '@aria/hal';`
`const hardware = HALRegistry.getHAL();`
`await hardware.initialize();`

When running in Expo, `MobileHAL` is injected. When deployed to a Raspberry Pi using a custom Node.js runner, `RaspberryPiHAL` is injected, which binds directly to ALSA audio, pigpio for motors, and GPIO for LEDs.

## Security & Child Safety

ARIA implements strict COPPA-compliant safety measures:

- **No Audio Storage:** Audio is processed in-memory and streamed via WebSockets. It is never written to disk.
- **PII Redaction:** The Guardrails service redacts phone numbers, emails, and addresses before text hits the LLM.
- **Crisis Detection:** Real-time regex matching detects self-harm or abuse signals and triggers immediate parent escalation.
- **Right to Erasure:** The Memory service exposes a single endpoint to cascade-delete all data for a specific child.

## CI/CD Pipeline

The repository includes a complete GitHub Actions workflow (`.github/workflows/ci.yml`) that:

1. Runs ESLint and TypeScript type checking.
2. Runs Ruff linting and pytest for all Python microservices.
3. Builds Docker images for the microservices.
4. Deploys the microservices to Google Cloud Run using Workload Identity Federation.

## License

Copyright (c) 2026 ARIA AI. All rights reserved.
