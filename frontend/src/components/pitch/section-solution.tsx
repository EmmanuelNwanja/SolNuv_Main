import Image from "next/image";
import Link from "next/link";
import { Card } from "./ui";

const overviewImage =
  "https://raw.githubusercontent.com/EmmanuelNwanja/pitchdeck/main/src/components/pitch/overview.png";

export function SectionSolution() {
  return (
    <div className="min-h-screen relative w-screen">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-lg">
        <span>Our solution</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-screen justify-center container">
        <div className="grid md:grid-cols-3 gap-8 px-4 md:px-0 md:pt-0 h-[580px] md:h-auto overflow-auto pb-[100px] md:pb-0">
          <div className="space-y-8">
            <Card>
              <h2 className="text-2xl">One OS</h2>
              <p className="text-[#878787] text-sm text-center">
                We set out to develop an all-encompassing business operating system
                that streamlines tedious work and unlocks better insights.
              </p>
            </Card>

            <Card>
              <h2 className="text-2xl">Intermediary</h2>
              <p className="text-[#878787] text-sm text-center">
                SolNuv serves as a bridge between operators and stakeholders,
                streamlining lifecycle workflows while staying product-first.
              </p>
            </Card>
          </div>
          <div className="space-y-8">
            <div className="px-8">
              <h2 className="text-[42px] text-center leading-[58px]">
                We offer business insights and automate tedious tasks, freeing users
                to focus on what they love.
              </h2>
            </div>

            <Card>
              <h2 className="text-2xl">User friendly & AI</h2>
              <p className="text-[#878787] text-sm text-center">
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
