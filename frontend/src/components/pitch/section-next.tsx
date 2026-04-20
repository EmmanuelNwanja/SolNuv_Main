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
        <span>Whats coming next</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container">
        <div className="grid md:grid-cols-3 gap-4 md:gap-8 px-4 md:px-0 pt-20 md:pt-0 pb-28 md:pb-0">
          <div className="space-y-8">
            <Card className="min-h-[250px] sm:min-h-[320px] md:min-h-[370px] border-emerald-500/35 bg-forest-900/30">
              <h2 className="text-xl font-display text-emerald-100">Invoice</h2>
              <span />
              <Image src={invoiceImage} width={362} height={220} alt="Invoice" quality={100} />
            </Card>

            <a href="https://solnuv.com" target="_blank" rel="noreferrer" className="block">
              <Card className="min-h-[250px] sm:min-h-[320px] md:min-h-[370px] border-amber-500/35 bg-amber-900/15">
                <h2 className="text-xl font-display text-amber-100">Engine</h2>
                <span className="underline text-amber-200/90">Read more</span>
                <Image src={engineImage} width={362} height={220} alt="Engine" quality={100} />
              </Card>
            </a>
          </div>
          <div className="space-y-8">
            <Card className="min-h-[250px] sm:min-h-[320px] md:min-h-[370px] border-emerald-500/25 bg-slate-900/80">
              <h2 className="text-xl font-display text-slate-100">Midday AI</h2>
              <span />
              <Image src={aiImage} width={362} height={220} alt="Midday AI" quality={100} />
            </Card>

            <Card className="min-h-[250px] sm:min-h-[320px] md:min-h-[370px] border-amber-500/25 bg-slate-900/90">
              <h2 className="text-xl font-display text-slate-100">Apps & integrations</h2>
              <span />
              <Image src={appsImage} width={362} height={220} alt="Apps & integrations" quality={100} />
            </Card>
          </div>

          <div className="ml-auto w-full border border-emerald-500/25 p-4 md:p-6 bg-[#0C0C0C]">
            <h2 className="mb-8 md:mb-24 block text-xl font-display text-emerald-100">Native app</h2>
            <span />
            <Image src={appImage} width={698} height={560} alt="App" quality={100} />
          </div>
        </div>
      </div>
    </div>
  );
}
