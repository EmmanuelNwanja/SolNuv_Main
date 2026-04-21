# Global PVSyst Parity Acceptance Matrix

This matrix is used as the release gate for SolNuv V2 report compute and rendering.

## Feature Flags

- `REPORTS_V2_ENABLED=true|false`: enables/disables `/design-reports/:projectId/v2/*` endpoints.

## Deterministic Replay

- Re-run the same design snapshot twice and verify:
  - `run_provenance.input_snapshot_hash` remains identical.
  - `run_provenance.formula_bundle_hash` remains identical unless registry versions changed.
  - deterministic suites pass in CI (`test:simulation-golden:all`, `test:simulation-invariants`).

## Formula & KPI Traceability

- Required in output payload:
  - `run_provenance.formula_bundle_hash`
  - `run_provenance.weather_dataset_hash`
  - `extended_metrics.formula_references`
- KPI trace references expected:
  - `annual_generation_kwh`, `self_consumption_pct`, `npv_25yr`, `irr_pct`, `lcoe_normal`, `p50_mwh`, `p90_mwh`, `p95_mwh`.

## Uncertainty / Probabilistic Workflow

- Required in output payload:
  - `extended_metrics.uncertainty.components_pct`
  - `extended_metrics.uncertainty.annual_generation_mwh.p50`
  - `extended_metrics.uncertainty.annual_generation_mwh.p90`
  - `extended_metrics.uncertainty.annual_generation_mwh.p95`
- Invariants:
  - `p95 <= p90 <= p50 <= p10`

## Project-Type Coverage

Representative projects must pass non-regression and traceability checks:

- Home (grid-tied)
- Commercial (grid-tied + BESS)
- Industrial/minigrid (hybrid)
- Utility (off-grid / large-scale assumptions)

## Explainability and Compliance Completeness

Each generated report variant must include:

- assumptions block
- uncertainty and probabilistic section
- provenance hash block
- formula reference summary
- disclaimer/limitations block

## Imported Third-Party Reports

Acceptance checks:

- Users can upload a `.pdf`, `.xls`, or `.xlsx` report to project imported reports.
- Uploaded report is listed in project results and public shared report.
- Imported report is labelled as `imported` (or provided label) in metadata.

