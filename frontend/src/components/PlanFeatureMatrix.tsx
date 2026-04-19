import { RiCheckLine, RiCloseLine } from "react-icons/ri";
import type { PlanCatalogEntry } from "../utils/planCatalog";

type MatrixValue = boolean | string | number;

interface MatrixRow {
  label: string;
  values: Record<string, MatrixValue>;
}

interface PlanFeatureMatrixProps {
  catalog: PlanCatalogEntry[];
  title?: string;
  subtitle?: string;
}

function formatLimit(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "Unlimited";
  if (value === 0) return "—";
  return `${value} ${unit}`;
}

function containsAny(features: string[], needles: string[]): boolean {
  const hay = features.map((f) => f.toLowerCase());
  return needles.some((n) => hay.some((h) => h.includes(n.toLowerCase())));
}

/**
 * Build the comparison matrix from the catalog. Feature rows are derived
 * from the structured `limits` plus heuristic detection of key feature strings.
 */
function buildRows(catalog: PlanCatalogEntry[]): MatrixRow[] {
  const idx = Object.fromEntries(catalog.map((p) => [p.id, p])) as Record<string, PlanCatalogEntry>;

  const row = (label: string, valueFor: (plan: PlanCatalogEntry) => MatrixValue): MatrixRow => ({
    label,
    values: Object.fromEntries(catalog.map((p) => [p.id, valueFor(p)])),
  });

  return [
    row("Project logging", (p) => p.id !== "free" || containsAny(p.features, ["project logging"])),
    row("Calculator uses / month", (p) => formatLimit(p.limits.calculator_uses_per_month, "uses")),
    row("Design simulations / month", (p) => formatLimit(p.limits.simulations_per_month, "runs")),
    row("Team seats", (p) => `${p.limits.team_members}`),
    row("Satellite irradiance data", (p) =>
      containsAny(p.features, ["satellite irradiance", "satellite"])
    ),
    row("Cradle-to-Grave certificates", (p) =>
      containsAny(p.features, ["cradle-to-grave", "certificate"])
    ),
    row("NESREA EPR compliance exports", (p) =>
      containsAny(p.features, ["nesrea", "epr", "compliance"]) || p.id === "elite" || p.id === "enterprise"
    ),
    row("PDF + CSV + Excel export", (p) =>
      containsAny(p.features, ["csv", "excel", "pdf", "export"]) || ["pro", "elite", "enterprise"].includes(p.id)
    ),
    row("AI customer agents", (p) => {
      if (p.id === "enterprise") return "All + priority";
      if (p.id === "elite") return "4 agents";
      if (containsAny(p.features, ["ai assistant"])) return "Assistant";
      return false;
    }),
    row("Priority support", (p) => ["elite", "enterprise"].includes(p.id)),
    row("Dedicated account manager", (p) => p.id === "enterprise"),
    row("Custom API integrations", (p) => p.id === "enterprise"),
  ].filter((r) => Object.keys(r.values).length > 0 && !!idx);
}

function renderCell(value: MatrixValue) {
  if (typeof value === "boolean") {
    return value ? (
      <RiCheckLine className="text-emerald-500 mx-auto" aria-label="Included" />
    ) : (
      <RiCloseLine className="text-slate-300 mx-auto" aria-label="Not included" />
    );
  }
  return <span className="text-xs text-slate-700 font-medium">{String(value)}</span>;
}

export default function PlanFeatureMatrix({
  catalog,
  title = "Compare plans",
  subtitle = "Every plan includes core design and project workflows — choose the tier that matches your scale.",
}: PlanFeatureMatrixProps) {
  const visible = catalog.filter((p) => p.id !== "free");
  if (visible.length === 0) return null;

  const rows = buildRows(visible);

  return (
    <section className="mt-12">
      <div className="text-center max-w-3xl mx-auto mb-6">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-forest-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-2">{subtitle}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm min-w-[620px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                Feature
              </th>
              {visible.map((plan) => (
                <th
                  key={plan.id}
                  className="px-4 py-3 text-center font-semibold text-forest-900 text-xs uppercase tracking-wide"
                  scope="col"
                >
                  {plan.name}
                  {plan.popular && (
                    <span className="block mt-1 text-[10px] font-bold text-amber-500">Most popular</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.label}>
                <th
                  scope="row"
                  className="text-left px-4 py-3 font-medium text-slate-700 text-sm bg-white"
                >
                  {r.label}
                </th>
                {visible.map((plan) => (
                  <td key={plan.id} className="px-4 py-3 text-center">
                    {renderCell(r.values[plan.id] ?? false)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
