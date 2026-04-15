# Platform Hardening Runbook

This runbook defines safe execution and rollback controls for platform hardening work.

## PR Slicing

1. PR-1: Critical security fixes (XSS, OTP exposure, battery QR write protection)
2. PR-2: Ops and reliability fixes (debug call cleanup, scheduled jobs, transactional create path)
3. PR-3: Migration and CI determinism fixes
4. PR-4: UX accessibility/resilience and targeted typing cleanup

## Baseline Regression Checklist (Before and After Each PR)

### Admin Flows

- OTP Management page loads pending OTPs.
- OTP generation succeeds and returns a non-secret operator payload.
- NERC admin queue loads and decisions can be submitted.

### User/Field Flows

- Blog post page renders rich content and outbound links correctly.
- Project regulatory page loads profile, saves profile, and submits application.
- Battery QR ledger page loads publicly.
- Battery QR log submission works only with authorized token path.

### Platform Flows

- Backend health endpoint responds.
- Frontend build passes.
- Backend lint + typecheck pass.
- NERC smoke regression passes.

## Rollback Checklist

1. Revert latest PR if user-facing regression or security side effect is detected.
2. For migration issues, run repair migration (if shipped) or roll forward with hotfix migration.
3. Re-run regression checklist.
4. Confirm admin and user critical flows before redeploy.

## Deployment Gate

Do not merge a hardening PR unless:

- Regression checklist is complete.
- CI workflow is green.
- Any migration has been validated on both clean and upgrade databases.
