import { PitchSlideFrame } from "./ui";

export function SectionVision() {
  return (
    <PitchSlideFrame
      eyebrow="Vision"
      title="Become the lifecycle intelligence layer for distributed solar infrastructure"
      lead="Our long-term goal is simple: every solar project should be measurable, governable, financeable, and recoverable from day one."
      accent="slate"
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
          SolNuv is building the operating foundation for climate infrastructure across emerging markets. We connect project evidence, partner execution, and policy-grade reporting so every stakeholder can act with confidence.
        </p>
      </div>
    </PitchSlideFrame>
  );
}
