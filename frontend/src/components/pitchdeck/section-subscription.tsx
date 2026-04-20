import { PitchSlideFrame } from "./ui";

const plans = [
  {
    name: "Starter / Team",
    focus: "Growing operators",
    detail: "Core simulations, dashboard controls, and essential reporting workflows.",
  },
  {
    name: "Pro / Partner",
    focus: "Multi-role organizations",
    detail: "Expanded analytics, collaboration tooling, and partner-grade lifecycle monitoring.",
  },
  {
    name: "Enterprise",
    focus: "Large portfolios and institutions",
    detail: "Custom governance, dedicated support, and integrated financing/compliance workflows.",
  },
];

export function SectionSubscription() {
  return (
    <PitchSlideFrame
      eyebrow="Business Model"
      title="Recurring SaaS with ecosystem expansion upside"
      lead="SolNuv monetizes through subscriptions while unlocking higher-value partnerships across financing, verification, and compliance workflows."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <article key={plan.name} className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
            <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">{plan.focus}</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{plan.name}</h3>
            <p className="mt-3 text-sm text-slate-700 leading-relaxed">{plan.detail}</p>
          </article>
        ))}
      </div>
    </PitchSlideFrame>
  );
}
