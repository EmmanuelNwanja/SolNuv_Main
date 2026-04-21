import Image from "next/image";
import Link from "next/link";
import { Card } from "./ui";

const foundersImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/founders.png";
const pontusImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/pontus.png";
const viktorImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/viktor.png";

export function SectionTeam() {
  return (
    <div className="min-h-[100svh] md:h-[100svh] md:overflow-hidden relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>Execution</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] md:h-[100svh] justify-center container">
        <div className="grid md:grid-cols-3 gap-4 md:gap-6 xl:gap-8 px-4 md:px-0 pt-20 md:pt-12 lg:pt-8 pb-28 md:pb-6 items-stretch max-w-[1280px] mx-auto">
          <div className="space-y-8 min-w-0">
            <Card className="items-start space-y-0 border-emerald-500/35 bg-forest-900/30">
              <Image src={pontusImage} alt="SolNuv team" width={76} height={76} quality={100} className="mb-4" />
              <h2 className="text-xl font-display text-emerald-100">Product & platform velocity</h2>
              <span className="text-emerald-200/90">Shipping cadence</span>
              <p className="text-emerald-50/75 text-sm !mt-2">
                A team biased toward end-to-end delivery: turning verification, lifecycle, and partner workflows into production software—not slideware.
              </p>
            </Card>

            <Card className="items-start space-y-0 border-amber-500/35 bg-amber-900/15">
              <Image src={viktorImage} alt="SolNuv team" width={76} height={76} quality={100} className="mb-4" />
              <h2 className="text-xl font-display text-amber-100">Domain + design craft</h2>
              <span className="mb-4 text-amber-200/90">Operator clarity</span>
              <p className="text-amber-50/75 text-sm !mt-2">
                Deep attention to how solar teams actually work—so the OS stays legible under financing, procurement, and compliance pressure.
              </p>
            </Card>
          </div>
          <div className="min-w-0">
            <Image src={foundersImage} alt="SolNuv team" width={650} height={875} quality={100} className="w-full h-auto" />
          </div>
          <div className="ml-auto min-w-0 w-full space-y-8 items-center flex justify-center">
            <h2 className="max-w-[24rem] lg:max-w-[30rem] text-[clamp(1.75rem,3.5vw,3.5rem)] font-display text-amber-100 font-medium text-center leading-tight">
              “Trust should compile into evidence the way code compiles into builds—structured, repeatable, and inspectable.”
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}
