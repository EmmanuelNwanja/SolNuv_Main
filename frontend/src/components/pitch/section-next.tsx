import Image from "next/image";
import Link from "next/link";
import { Card } from "./ui";

const appImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/app.png";
const appsImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/apps.png";
const engineImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/engine.png";
const invoiceImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/invoice.png";
const aiImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/midday-ai.png";

export function SectionNext() {
  return (
    <div className="min-h-[100svh] relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>What comes next</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container">
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 xl:gap-8 px-4 md:px-0 pt-20 md:pt-12 lg:pt-8 pb-28 md:pb-6 items-stretch max-w-[1280px] mx-auto">
          <div className="space-y-8 min-w-0">
            <Card className="min-h-[240px] sm:min-h-[300px] md:min-h-[245px] xl:min-h-[340px] border-emerald-500/35 bg-forest-900/30">
              <h2 className="text-xl font-display text-emerald-100">Attestation graph</h2>
              <p className="text-emerald-50/70 text-xs text-center mb-2 px-2">
                Richer links between projects, people, institutes, and outcomes—what the homepage doesn’t need to spell out.
              </p>
              <span />
              <Image src={invoiceImage} width={362} height={220} alt="" quality={100} className="w-full h-auto" />
            </Card>

            <a href="https://solnuv.com" target="_blank" rel="noreferrer" className="block">
              <Card className="min-h-[240px] sm:min-h-[300px] md:min-h-[245px] xl:min-h-[340px] border-amber-500/35 bg-amber-900/15">
                <h2 className="text-xl font-display text-amber-100">Model governance</h2>
                <span className="underline text-amber-200/90">solnuv.com</span>
                <p className="text-amber-50/70 text-xs text-center mb-2 px-2">
                  Traceable AI: versions, prompts, reviewer overrides—enterprise procurement asks for this even when users don’t.
                </p>
                <Image src={engineImage} width={362} height={220} alt="" quality={100} className="w-full h-auto" />
              </Card>
            </a>
          </div>
          <div className="space-y-8 min-w-0">
            <Card className="min-h-[240px] sm:min-h-[300px] md:min-h-[245px] xl:min-h-[340px] border-emerald-500/25 bg-slate-900/80">
              <h2 className="text-xl font-display text-slate-100">Advisor depth</h2>
              <p className="text-slate-400 text-xs text-center mb-2 px-2">
                Vertical copilots tuned to solar finance, EPC QA, and recovery—not generic chat wrappers.
              </p>
              <span />
              <Image src={aiImage} width={362} height={220} alt="" quality={100} className="w-full h-auto" />
            </Card>

            <Card className="min-h-[240px] sm:min-h-[300px] md:min-h-[245px] xl:min-h-[340px] border-amber-500/25 bg-slate-900/90">
              <h2 className="text-xl font-display text-slate-100">Institutional pipes</h2>
              <p className="text-slate-400 text-xs text-center mb-2 px-2">
                SSO, audit exports, and banker-grade evidence—where the multiple re-rates if you win.
              </p>
              <span />
              <Image src={appsImage} width={362} height={220} alt="" quality={100} className="w-full h-auto" />
            </Card>
          </div>

          <div className="ml-auto min-w-0 w-full border border-emerald-500/25 p-4 md:p-6 bg-[#0C0C0C]">
            <h2 className="mb-4 md:mb-8 block text-xl font-display text-emerald-100">Field + control room</h2>
            <p className="text-slate-500 text-xs mb-4 max-w-md">
              The homepage promises outcomes; the product roadmap tightens the loop between site reality and portfolio governance.
            </p>
            <span />
            <Image src={appImage} width={698} height={560} alt="" quality={100} className="w-full h-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
