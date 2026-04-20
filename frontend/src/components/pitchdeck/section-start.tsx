import Image from "next/image";
import { PitchSlideFrame, StatCard } from "./ui";

export function SectionStart() {
  return (
    <PitchSlideFrame
      eyebrow="Pitch Deck / 2026"
      title="SolNuv: Solar lifecycle intelligence built for Africa"
      lead="We help solar operators, partners, and regulators run reliable projects end-to-end: from design and compliance to financing, recovery, and impact reporting."
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-center lg:col-span-1">
          <Image
            src="/pitchdeck/solnuv-deck-badge.svg"
            alt="SolNuv pitch deck identity card"
            width={280}
            height={146}
            className="w-full h-auto"
            priority
          />
        </article>
        <StatCard
          label="Coverage"
          value="Design to Recovery"
          detail="One operating system for simulation, deployment workflows, monitoring, and end-of-life compliance."
        />
        <StatCard
          label="Audience"
          value="Teams + Partners"
          detail="Installers, distributors, recyclers, financiers, and public agencies work from shared lifecycle data."
        />
        <StatCard
          label="Positioning"
          value="Naira-first SaaS"
          detail="Built for West African operational realities with local compliance support and partner-ready workflows."
        />
      </div>
    </PitchSlideFrame>
  );
}
