import React from "react";

type FormulaEntry = {
  id: string;
  version: string;
  expression_ref: string;
  output_unit: string;
  rounding_mode: string;
};

type Props = {
  formulaEntries?: FormulaEntry[];
  assumptions?: string[];
  limitations?: string[];
  uncertainty?: Record<string, unknown> | null;
  provenance?: Record<string, unknown> | null;
};

function fmt(value: unknown, d = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d });
}

export default function ReportGovernancePanels({
  formulaEntries = [],
  assumptions = [],
  limitations = [],
  uncertainty = null,
  provenance = null,
}: Props) {
  const weatherVar = Number((uncertainty as any)?.weather_variability_pct || 0);
  const modelVar = Number((uncertainty as any)?.model_variability_pct || 0);
  const opsVar = Number((uncertainty as any)?.operations_variability_pct || 0);
  const totalVar = weatherVar + modelVar + opsVar;

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-[#0D3B2E] mb-3">Units & Precision</h3>
        <p className="text-sm text-gray-600 mb-3">
          All KPI values are rendered with explicit units and deterministic rounding.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-xs text-gray-500 mb-1">Storage precision</p>
            <p className="font-medium">Canonical numeric precision in compute payloads</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-xs text-gray-500 mb-1">Display precision</p>
            <p className="font-medium">Report-specific rounding for human readability</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-xs text-gray-500 mb-1">Rounding mode</p>
            <p className="font-medium">Default: half_away_from_zero</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-[#0D3B2E] mb-3">Formula References</h3>
        {formulaEntries.length === 0 ? (
          <p className="text-sm text-gray-500">
            Formula registry entries are scaffolded in backend and will appear here when V2 compute payload is enabled.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0D3B2E] text-white">
                  <th className="px-3 py-2 text-left">Formula ID</th>
                  <th className="px-3 py-2 text-left">Version</th>
                  <th className="px-3 py-2 text-left">Expression Ref</th>
                  <th className="px-3 py-2 text-left">Output Unit</th>
                  <th className="px-3 py-2 text-left">Rounding</th>
                </tr>
              </thead>
              <tbody>
                {formulaEntries.map((entry) => (
                  <tr key={`${entry.id}-${entry.version}`} className="border-b">
                    <td className="px-3 py-2 font-mono">{entry.id}</td>
                    <td className="px-3 py-2">{entry.version}</td>
                    <td className="px-3 py-2 font-mono">{entry.expression_ref}</td>
                    <td className="px-3 py-2">{entry.output_unit}</td>
                    <td className="px-3 py-2">{entry.rounding_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-[#0D3B2E] mb-3">Uncertainty Decomposition</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-xs text-gray-500">Weather</p>
            <p className="font-semibold">{fmt(weatherVar, 2)}%</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
            <p className="text-xs text-gray-500">Model</p>
            <p className="font-semibold">{fmt(modelVar, 2)}%</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-xs text-gray-500">Operations</p>
            <p className="font-semibold">{fmt(opsVar, 2)}%</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-xs text-gray-500">Combined</p>
            <p className="font-semibold">{fmt(totalVar, 2)}%</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-[#0D3B2E] mb-3">Assumptions & Limitations</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold mb-2 text-emerald-700">Assumptions</p>
            <ul className="space-y-1 text-gray-600">
              {(assumptions.length ? assumptions : [
                "Weather input is based on available climatology/source datasets.",
                "Model coefficients follow currently active engine/formula versions.",
                "Financial escalations are applied as configured in design inputs.",
              ]).map((a) => (
                <li key={a}>- {a}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-2 text-amber-700">Limitations</p>
            <ul className="space-y-1 text-gray-600">
              {(limitations.length ? limitations : [
                "Outputs are deterministic given identical inputs, not guarantees of field outcomes.",
                "Data quality and missing-site context can materially affect model confidence.",
                "Results should be reviewed by qualified engineers before procurement/final sign-off.",
              ]).map((l) => (
                <li key={l}>- {l}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-[#0D3B2E] mb-3">Provenance Audit</h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-xs text-gray-500">Engine Version</p>
            <p className="font-mono">{String((provenance as any)?.engine_version || "—")}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-xs text-gray-500">Input Snapshot Hash</p>
            <p className="font-mono break-all">{String((provenance as any)?.input_snapshot_hash || (provenance as any)?.inputs_hash || "—")}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-xs text-gray-500">Formula Bundle Hash</p>
            <p className="font-mono break-all">{String((provenance as any)?.formula_bundle_hash || "—")}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border">
            <p className="text-xs text-gray-500">Weather Dataset Hash</p>
            <p className="font-mono break-all">{String((provenance as any)?.weather_dataset_hash || "—")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
