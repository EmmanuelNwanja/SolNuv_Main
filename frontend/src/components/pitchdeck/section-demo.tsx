import Image from "next/image";
import { PitchSlideFrame } from "./ui";

const demoShots = [
  {
    title: "Design Performance View",
    src: "/platform-snapshots/design-overview.png",
    copy: "Inspect production assumptions, monthly output patterns, and technical constraints before deployment.",
  },
  {
    title: "AI Quality Review",
    src: "/platform-snapshots/ai-analysis.png",
    copy: "Generate structured feedback on design risks, economic viability, and correction priorities.",
  },
  {
    title: "Compliance Report Studio",
    src: "/platform-snapshots/compliance-reports.png",
    copy: "Produce audit-ready lifecycle reports and maintain evidence continuity across project teams.",
  },
];

export function SectionDemo() {
  return (
    <PitchSlideFrame
      eyebrow="Product Demo"
      title="Built modules that operators can use immediately"
      lead="Each module is production-ready and designed to reduce operational lag across project execution and governance."
      accent="slate"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {demoShots.map((shot) => (
          <article key={shot.title} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <Image src={shot.src} alt={shot.title} width={1200} height={800} className="h-40 w-full object-cover" />
            <div className="p-4">
              <h3 className="font-semibold text-slate-900">{shot.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{shot.copy}</p>
            </div>
          </article>
        ))}
      </div>
    </PitchSlideFrame>
  );
}
