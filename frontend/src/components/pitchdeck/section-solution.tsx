import Image from "next/image";
import { PitchSlideFrame } from "./ui";

const capabilities = [
  "Simulation and design quality analysis with AI-assisted guidance",
  "Portfolio dashboards for project health, alerts, and impact tracking",
  "Compliance-ready reporting for regulatory and enterprise stakeholders",
  "Partner workflows for recyclers and financiers in one shared platform",
];

export function SectionSolution() {
  return (
    <PitchSlideFrame
      eyebrow="Our Solution"
      title="SolNuv unifies solar operations into a single lifecycle platform"
      lead="Instead of stitching tools together, teams run planning, execution, compliance, and recovery in one connected operating layer."
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100">
          <Image
            src="/platform-snapshots/dashboard.png"
            alt="SolNuv dashboard view"
            width={1400}
            height={900}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <div className="lg:col-span-2 space-y-3">
          {capabilities.map((item) => (
            <div key={item} className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-slate-800">
              {item}
            </div>
          ))}
        </div>
      </div>
    </PitchSlideFrame>
  );
}
