import Image from "next/image";
import Link from "next/link";
import { Card } from "./ui";

const overviewImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/overview.png";

export function SectionSolution() {
  return (
    <div className="min-h-[100svh] md:h-[100svh] md:overflow-hidden relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>Our thesis</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] md:h-[100svh] justify-center container">
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 xl:gap-8 px-4 md:px-0 pt-20 md:pt-12 lg:pt-8 pb-28 md:pb-6 items-stretch max-w-[1280px] mx-auto">
          <div className="space-y-8 min-w-0">
            <Card className="border-emerald-500/35 bg-forest-900/30 md:px-5 md:pt-6 md:pb-5">
              <h2 className="text-2xl font-display text-emerald-100">One operating system</h2>
              <p className="text-emerald-50/75 text-sm text-center">
                A single workspace for solar + BESS execution: modelling, verification, partner coordination, and lifecycle evidence—so outputs stay consistent as teams scale.
              </p>
            </Card>

            <Card className="border-amber-500/35 bg-amber-900/15 md:px-5 md:pt-6 md:pb-5">
              <h2 className="text-2xl font-display text-amber-100">Trust as data</h2>
              <p className="text-amber-50/75 text-sm text-center">
                Project checks and institute-backed competency flows create structured attestations—not vibes—so downstream stakeholders can reuse proof without re-auditing everything.
              </p>
            </Card>
          </div>
          <div className="space-y-6 md:space-y-5 xl:space-y-8 min-w-0">
            <div className="px-2 md:px-8">
              <h2 className="text-2xl sm:text-3xl md:text-[clamp(1.8rem,2.8vw,2.45rem)] text-center leading-tight md:leading-[1.28] font-display text-slate-100">
                AI-native doesn’t mean “chat everywhere.” It means models accelerate review, matching, and documentation inside governed workflows—with humans owning approvals.
              </h2>
            </div>

            <Card className="border-emerald-500/25 bg-slate-900/80 md:px-5 md:pt-6 md:pb-5">
              <h2 className="text-2xl font-display text-slate-100">Partner rails</h2>
              <p className="text-slate-300 text-sm text-center">
                Recyclers, financiers, and training institutes plug into the same execution graph—turning SolNuv into distribution, not just software seats.
              </p>
            </Card>
          </div>

          <div className="ml-auto min-w-0 w-full">
            <Image src={overviewImage} alt="Overview" width={650} height={875} quality={100} className="w-full h-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
