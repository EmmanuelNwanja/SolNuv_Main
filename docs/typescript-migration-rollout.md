# SolNuv TypeScript Migration Rollout Gates

This document defines the minimum checks to release each migration phase safely while the app is live.

## Mandatory Gate Before Merge

Run from repository root:

```bash
npm run gate:ts-migration
```

This gate currently enforces local compile safety:

- frontend typecheck (`frontend`)
- backend typecheck (`backend`)

For rollout validation (staging/prod endpoints):

```bash
npm run gate:rollout
```

This additionally runs the HTTP header smoke test (`scripts/smoke-check-headers.mjs`).

## Mandatory Gate Before Production Deploy

1. Confirm branch passed CI (`gate:ts-migration`).
2. Run endpoint rollout gate against target environment (`gate:rollout`).
3. Review migration phase scope (folders/files converted in this release).
4. Verify no runtime-entrypoint breakage:
   - backend still starts from JS runtime path
   - any TS additions are additive unless transpilation is in place
5. Execute manual API smoke for touched domains.
6. Deploy using staged rollout.

## Staged Rollout

For every migration phase:

1. Deploy to staging and run smoke tests.
2. Deploy to a small production slice (canary) first.
3. Watch:
   - 5xx error rate
   - auth failures
   - route-level latency
4. Promote to full traffic only after stability window.

## Rollback Checkpoints

Treat each migration phase as a rollback checkpoint:

- `checkpoint-1`: tooling + configs
- `checkpoint-2`: shared contracts
- `checkpoint-3`: frontend wave
- `checkpoint-4`: backend wave

If regressions appear, roll back only the latest checkpoint release and keep prior stable checkpoints active.
