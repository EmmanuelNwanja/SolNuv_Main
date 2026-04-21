# SolNuv Report System Upgrade Blueprint (Accuracy-First)

## Goal
Deliver a deterministic, auditable report stack that meets or exceeds PVsyst-level depth without breaking existing report, simulation, or export flows.

This plan is designed to layer on top of existing services in:
- `backend/src/services/simulationService.ts`
- `backend/src/services/pvSimulationService.ts`
- `backend/src/services/bessSimulationService.ts`
- `backend/src/services/financialService.ts`
- `backend/src/services/designReportService.ts`

## Design System Upgrade Path (Report UI)
To match PVsyst-grade readability, standardize report presentation tokens and blocks.

### 1) Report Design Tokens
- Typography scale for titles, section headers, tables, notes.
- Color roles: `primary`, `accent`, `warning`, `neutral`, `pass`, `fail`.
- Spacing rhythm for section stacks and chart/table gutters.
- Printable A4 and responsive-screen variants from one token source.

### 2) Reusable Report Blocks
- `ReportSectionHeader`
- `MetricGrid`
- `LossWaterfall`
- `UncertaintyBand`
- `FinancialTable`
- `CO2BalanceCard`
- `AssumptionsAndLimitations`

### 3) Render Rules
- No section may render raw numbers without units.
- Every chart must include source and time basis.
- Every table must include precision and rounding footnote.
- Every derived KPI must be linkable to formula references.

## Current Baseline (Already in Place)
- Simulation engine already computes hourly energy flows, monthly summaries, loss waterfall, risk envelope, and financial metrics.
- `run_provenance` is already stamped in `simulation_results` for engine/version/input tracing.
- PDF and Excel report exports already exist and are production-wired.
- Export pack endpoint already exists, so traceability packaging is a natural extension path.

## Canonical Report Schema (V2)
Introduce a single canonical JSON contract (`DesignReportV2`) that separates:
1) inputs and assumptions,
2) deterministic compute outputs,
3) presentation metadata.

### 1) Schema Top-Level
```ts
type DesignReportV2 = {
  schema_version: "2.0.0";
  report_id: string;
  generated_at: string;
  trace: ReportTrace;
  project: ProjectContext;
  site: SiteContext;
  system: SystemTopology;
  assumptions: AssumptionSet;
  results: ResultSet;
  uncertainty: UncertaintySet;
  economics: EconomicSet;
  environmental: EnvironmentalSet;
  compliance: ComplianceSet;
  explainability: ExplainabilitySet;
};
```

### 2) Section Mapping (PVsyst-level parity)
- **Project summary**: project/site metadata, weather dataset, simulation timestamp.
- **General parameters**: orientation, topology, model choices (Perez, IAM model, degradation regime).
- **PV array characteristics**: module/inverter sizing, DC:AC ratio, thermal coefficients.
- **Detailed user needs/load**: load profile source, annual and daily demand assumptions.
- **Main results**: annual energy, specific yield, PR, self-consumption, solar fraction.
- **Loss diagram**: ordered loss buckets from irradiation to AC output with percentages.
- **Predefined graphs**: daily IO, power duration, monthly production/savings.
- **P50/P90**: weather and model uncertainty decomposition + production probability table.
- **Cost of system**: CAPEX line items + OPEX assumptions.
- **Financial analysis**: payback, NPV, IRR, ROI, yearly table and cumulative cashflow.
- **CO2 balance**: lifecycle emissions, replaced emissions, net avoided CO2.

### 3) Unit and Precision Metadata
Each numeric field in V2 must carry:
- `unit` (e.g., `kWh`, `kWp`, `gCO2/kWh`, `NGN`, `%`)
- `precision` (storage precision)
- `display_precision` (report rendering precision)
- `rounding_mode` (default: `half_away_from_zero`)

## Formula Governance Model
Add a formula registry with semantic versioning so every output is reproducible.

### 1) Registry Contract
```ts
type FormulaRegistryEntry = {
  id: string;                 // e.g. "financial.npv"
  version: string;            // e.g. "1.2.0"
  expression_ref: string;     // function path or expression key
  input_units: Record<string, string>;
  output_unit: string;
  rounding_mode: string;
  test_vectors: string[];     // IDs for golden vectors
  invariants: string[];       // IDs for invariant checks
  status: "active" | "deprecated";
};
```

### 2) Determinism Rules
- Fixed simulation seed policy for stochastic outputs (already seeded; keep mandatory).
- Stable ordering for all iterated aggregates and serialized objects.
- Explicit rounding only at approved boundaries (storage vs display).
- Hashing policy:
  - `input_snapshot_hash` over normalized inputs,
  - `formula_bundle_hash` over formula IDs+versions,
  - `weather_dataset_hash` over weather payload metadata.

### 3) Required Invariants
- Energy balance closure across yearly and monthly totals.
- `solar_utilised + curtailed + exported == generated` within epsilon.
- Financial consistency: yearly cashflow rollup equals summary metrics.
- Non-negative constraints for physically non-negative dimensions.

## Compute/Presentation Split (Non-Breaking)
Implement V2 in parallel with existing report payloads.

### 1) Services
- `reportComputeService` (new): emits canonical `DesignReportV2` JSON only.
- `reportRenderService` (new): consumes V2 JSON to render PDF/HTML/Excel.

### 2) Compatibility
- Keep current endpoints unchanged.
- Add versioned endpoint family:
  - `/api/design-reports/:projectId/v2/json`
  - `/api/design-reports/:projectId/v2/pdf`
  - `/api/design-reports/:projectId/v2/excel`
- Feature flag: `REPORT_V2_ENABLED`.
- Default route remains V1 until parity checklist passes.

## Accuracy and QA Framework

### 1) Golden Vectors
Create fixed benchmark cases (small, medium, high irradiation, off-grid, hybrid, high clipping).
Each case stores:
- normalized inputs,
- expected result envelope,
- exact formula versions used.

### 2) Property and Invariant Tests
- Energy conservation and monotonicity under controlled input perturbations.
- Battery SOC bounds never violated.
- P50/P90 ordering always valid (`P90 <= P50`).
- Sensitivity checks (e.g., higher tariff -> non-decreasing savings).

### 3) Explainability Blocks in Reports
Every report includes:
- assumptions table,
- formula references by section,
- uncertainty assumptions,
- confidence and limitations narrative.

## Rollout Plan

### Phase 1 - Canonical Backbone
- Add V2 schema, formula registry, and JSON compute endpoint.
- Map existing simulation outputs into canonical section structure.
- Add unit metadata and rounding policy enforcement.

### Phase 2 - Uncertainty and Financial Depth
- Expand uncertainty decomposition to weather+model+operations factors.
- Add richer P50/P90 section and full financial table parity.
- Upgrade loss diagram and section-level explainability references.

### Phase 3 - Reporting Quality and Templates
- Introduce publication-grade templates (bankability/compliance variants).
- Add configurable regional compliance annexes and partner-branded themes.
- Make V2 default behind migration flag after acceptance criteria pass.

## Acceptance Checklist
- No breaking changes to existing report downloads or share links.
- V2 JSON is fully deterministic for identical inputs.
- All invariants pass in CI for every golden vector.
- V2 PDF section coverage matches PVsyst-style structure.
- Numeric parity against baseline formulas stays within approved tolerances.
