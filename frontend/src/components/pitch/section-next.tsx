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
    <div className="min-h-screen relative w-screen">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-lg">
        <span>Whats coming next</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-screen justify-center container">
        <div className="grid md:grid-cols-3 gap-8 px-4 md:px-0 md:pt-0 h-[580px] md:h-auto overflow-auto pb-[100px] md:pb-0">
          <div className="space-y-8">
            <Card className="min-h-[370px]">
              <h2 className="text-xl">Invoice</h2>
              <span />
              <Image src={invoiceImage} width={362} height={220} alt="Invoice" quality={100} />
            </Card>

            <a href="https://solnuv.com" target="_blank" rel="noreferrer" className="block">
              <Card className="min-h-[370px]">
                <h2 className="text-xl">Engine</h2>
                <span className="underline">Read more</span>
                <Image src={engineImage} width={362} height={220} alt="Engine" quality={100} />
              </Card>
            </a>
          </div>
          <div className="space-y-8">
            <Card className="min-h-[370px]">
              <h2 className="text-xl">Midday AI</h2>
              <span />
              <Image src={aiImage} width={362} height={220} alt="Midday AI" quality={100} />
            </Card>

            <Card className="min-h-[370px]">
              <h2 className="text-xl">Apps & integrations</h2>
              <span />
              <Image src={appsImage} width={362} height={220} alt="Apps & integrations" quality={100} />
            </Card>
          </div>

          <div className="ml-auto w-full max-w-[820px] h-full border border-border p-6 bg-[#0C0C0C]">
            <h2 className="mb-24 block text-xl">Native app</h2>
            <span />
            <Image src={appImage} width={698} height={560} alt="App" quality={100} />
          </div>
        </div>
      </div>
    </div>
  );
}
