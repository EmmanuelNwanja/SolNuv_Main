import { PitchSlideFrame } from "./ui";

const roadmap = [
  "Deepen lifecycle intelligence and automated risk scoring",
  "Expand partner workflow modules for recyclers and financiers",
  "Scale enterprise and public-sector adoption pipelines",
  "Increase traceability and impact reporting across project fleets",
];

export function SectionNext() {
  return (
    <PitchSlideFrame
      eyebrow="What Comes Next"
      title="Execution roadmap focused on scale and trust"
      lead="Our next phase is about distribution, stronger interoperability, and measurable outcomes across technical and financial stakeholders."
      accent="amber"
    >
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {roadmap.map((item) => (
          <li key={item} className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-slate-800">
            {item}
          </li>
        ))}
      </ul>
    </PitchSlideFrame>
  );
}
