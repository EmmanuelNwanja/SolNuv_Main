import Image from "next/image";
import Link from "next/link";
import { Card } from "./ui";

const overviewImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/overview.png";

export function SectionSolution() {
  return (
    <div className="min-h-[100svh] relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>Our solution</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container">
        <div className="grid md:grid-cols-3 gap-4 md:gap-8 px-4 md:px-0 pt-20 md:pt-0 pb-28 md:pb-0">
          <div className="space-y-8">
            <Card className="border-emerald-500/35 bg-forest-900/30">
              <h2 className="text-2xl font-display text-emerald-100">One OS</h2>
              <p className="text-emerald-50/75 text-sm text-center">
                We set out to develop an all-encompassing business operating system
                that streamlines tedious work and unlocks better insights.
              </p>
            </Card>

            <Card className="border-amber-500/35 bg-amber-900/15">
              <h2 className="text-2xl font-display text-amber-100">Intermediary</h2>
              <p className="text-amber-50/75 text-sm text-center">
                SolNuv serves as a bridge between operators and stakeholders,
                streamlining lifecycle workflows while staying product-first.
              </p>
            </Card>
          </div>
          <div className="space-y-8">
            <div className="px-2 md:px-8">
              <h2 className="text-2xl sm:text-3xl md:text-[42px] text-center leading-tight md:leading-[58px] font-display text-slate-100">
                We offer business insights and automate tedious tasks, freeing users
                to focus on what they love.
              </h2>
            </div>

            <Card className="border-emerald-500/25 bg-slate-900/80">
              <h2 className="text-2xl font-display text-slate-100">User friendly & AI</h2>
              <p className="text-slate-300 text-sm text-center">
                Built with the community, integrating AI-driven suggestions,
                automation, and fast access to operational insights.
              </p>
            </Card>
          </div>

          <div className="ml-auto w-full">
            <Image src={overviewImage} alt="Overview" width={650} height={875} quality={100} />
          </div>
        </div>
      </div>
    </div>
  );
}
