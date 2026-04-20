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
    <div className="min-h-[100svh] relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>Who we are</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container">
        <div className="grid md:grid-cols-3 gap-4 md:gap-8 px-4 md:px-0 pt-20 md:pt-0 pb-28 md:pb-0">
          <div className="space-y-8">
            <Card className="items-start space-y-0 border-emerald-500/35 bg-forest-900/30">
              <Image src={pontusImage} alt="Pontus" width={76} height={76} quality={100} className="mb-4" />
              <h2 className="text-xl font-display text-emerald-100">Pontus Abrahamsson</h2>
              <span className="text-emerald-200/90">Co-founder</span>
              <p className="text-emerald-50/75 text-sm !mt-2">
                Fullstack developer with years of studio experience serving major
                product teams.
              </p>
            </Card>

            <Card className="items-start space-y-0 border-amber-500/35 bg-amber-900/15">
              <Image src={viktorImage} alt="Viktor" width={76} height={76} quality={100} className="mb-4" />
              <h2 className="text-xl font-display text-amber-100">Viktor Hofte</h2>
              <span className="mb-4 text-amber-200/90">Co-founder</span>
              <p className="text-amber-50/75 text-sm !mt-2">
                Designer and product builder with deep startup and enterprise brand
                experience.
              </p>
            </Card>
          </div>
          <div>
            <Image src={foundersImage} alt="Founders" width={650} height={875} quality={100} />
          </div>
          <div className="ml-auto w-full space-y-8 items-center flex">
            <h2 className="text-3xl sm:text-5xl md:text-[64px] font-display text-amber-100 font-medium text-center leading-tight">
              “The speed and velocity we have together is unmatched.”
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}
