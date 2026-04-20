import { PitchSlideFrame } from "./ui";

const teamStrengths = [
  {
    title: "Domain-grounded product design",
    copy: "Built around solar deployment realities, partner workflows, and African market constraints.",
  },
  {
    title: "Execution-focused engineering",
    copy: "Modular architecture enables continuous rollout of AI, analytics, and compliance features.",
  },
  {
    title: "Ecosystem partnership posture",
    copy: "Structured to collaborate with installers, recyclers, financiers, and public institutions.",
  },
];

export function SectionTeam() {
  return (
    <PitchSlideFrame
      eyebrow="Team"
      title="A mission-driven team building dependable climate infrastructure"
      lead="SolNuv combines technical execution with ecosystem collaboration to close lifecycle gaps across distributed solar."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {teamStrengths.map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.copy}</p>
          </article>
        ))}
      </div>
    </PitchSlideFrame>
  );
}
