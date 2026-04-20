import { PitchSlideFrame, StatCard } from "./ui";

export function SectionTraction() {
  return (
    <PitchSlideFrame
      eyebrow="Traction"
      title="Measured traction across product usage and ecosystem alignment"
      lead="SolNuv is growing as a systems layer for teams that need reliability, compliance confidence, and partner interoperability."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Simulation Workloads"
          value="10+ Runs"
          detail="Public platform telemetry already reflects active project simulation activity."
        />
        <StatCard
          label="AI Operations"
          value="Multi-agent"
          detail="Specialized AI assistants support quality review and technical reasoning."
        />
        <StatCard
          label="Lifecycle Ambition"
          value="1M Assets"
          detail="Roadmap and operations target large-scale asset traceability and recovery outcomes."
        />
        <StatCard
          label="Partner Network"
          value="OEM + Recycler + Finance"
          detail="Cross-functional workflows are expanding across technical and commercial stakeholders."
        />
      </div>
    </PitchSlideFrame>
  );
}
