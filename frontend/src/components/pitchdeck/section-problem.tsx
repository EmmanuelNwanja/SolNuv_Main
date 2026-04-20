import { PitchSlideFrame } from "./ui";

const painPoints = [
  {
    title: "Fragmented toolchain",
    copy: "Project teams juggle separate tools for design, performance checks, customer onboarding, compliance evidence, and after-sales operations.",
  },
  {
    title: "Weak lifecycle visibility",
    copy: "Many deployments go dark after commissioning, making service decisions and replacement planning reactive instead of data-driven.",
  },
  {
    title: "Compliance friction",
    copy: "Regulatory reporting and EPR-ready documentation are often handled manually, increasing audit risk and slowing partner coordination.",
  },
  {
    title: "Capital trust gap",
    copy: "Financiers and enterprise buyers struggle to verify quality and portfolio performance consistently across vendors.",
  },
];

export function SectionProblem() {
  return (
    <PitchSlideFrame
      eyebrow="The Problem"
      title="Solar growth is accelerating, but operations remain disconnected"
      lead="As distributed solar scales, operators need one reliable source of truth. Today, the workflow is scattered and expensive to manage."
      accent="amber"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {painPoints.map((item) => (
          <article key={item.title} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <h3 className="font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">{item.copy}</p>
          </article>
        ))}
      </div>
    </PitchSlideFrame>
  );
}
