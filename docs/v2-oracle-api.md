# SolNuv V2 Oracle API (Parallel Runtime)

This document captures the initial deployable V2 API surface running alongside V1.

## Base Path

- `/api/v2`

## Authentication

- Uses existing bearer auth and profile checks.
- Organization-scoped endpoints require `organization_id`.
- V2 membership and role checks are enforced for operational routes.

## Endpoints

### Health

- `GET /api/v2/health`
- Returns V2 runtime status and active chain provider mode.

### Onboarding

- `POST /api/v2/onboarding/register-actor`
- Creates a V2 organization and membership for the authenticated user.
- Required fields:
  - `organization_name`
  - `actor_type` (`installer|epc|financier|recycler|buyer|regulator|solnuv_admin`)

### Asset Serial Registry

- `POST /api/v2/assets/serial-registrations`
- Registers serial-level assets for a project.
- Mandatory serials for financed paths (`financed=true`).
- Duplicate serials are blocked globally in V2 registry.

### Escrow Policy Templates

- `GET /api/v2/escrow/policies?organization_id=<uuid>`
- `POST /api/v2/escrow/policies`

### Escrow Oracle Decisions

- `POST /api/v2/escrow/decisions/evaluate`
- Deterministic decision output:
  - `RELEASE_APPROVED`
  - `PARTIAL_RELEASE`
  - `HOLD`
- Stores chain attestation metadata (`chain_id`, `tx_hash`, `payload_hash`, etc.).

### Custodian Execution

- `POST /api/v2/escrow/executions/submit`
- Submits a prior release decision to the configured custodian adapter.

### Custodian Callback (inbound)

- `POST /api/v2/custodian/callbacks/execution-status`
- Receives external execution status updates from custodian providers.
- Signature verification:
  - expected header: `x-custodian-signature` (or `x-solnuv-signature`)
  - verified with `V2_CUSTODIAN_CALLBACK_SECRET` (fallback: `V2_CUSTODIAN_WEBHOOK_SECRET`)
- Replay protection:
  - callback payload must include `event_id`
  - duplicate `event_id` values are ignored safely

### Lifecycle Events

- `GET /api/v2/lifecycle/events?organization_id=<uuid>&project_id=<uuid>`
- `POST /api/v2/lifecycle/events`
- Records auditable lifecycle events and attests payload hashes.

## Environment Variables

- `V2_CHAIN_PROVIDER`
- `V2_CHAIN_ID`
- `V2_CUSTODIAN_PROVIDER`
- `V2_CHAIN_ATTESTATION_URL`
- `V2_CHAIN_ATTESTATION_API_KEY`
- `V2_CUSTODIAN_WEBHOOK_URL`
- `V2_CUSTODIAN_WEBHOOK_SECRET`
- `V2_CUSTODIAN_CALLBACK_SECRET`

Current implementation supports `simulated` adapters for safe parallel rollout before live custodian/chain integrations.

## Reliability Guardrails

- Idempotent request handling (when `x-idempotency-key` is provided) for:
  - escrow decision evaluation
  - custodian execution submission
- Outbox and dead-letter primitives:
  - `v2_outbox_events`
  - `v2_dead_letter_queue`
- Callback replay protection:
  - `v2_callback_events` unique per provider/event id

## Operational Scripts

- Smoke check:
  - `npm run test:v2-smoke -- https://api.solnuv.com`
- Outbox worker:
  - `npm run v2:outbox-worker`

