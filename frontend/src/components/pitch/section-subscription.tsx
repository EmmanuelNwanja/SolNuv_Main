import Link from "next/link";
import { Card } from "./ui";

export function SectionSubscription() {
  return (
    <div className="min-h-[100svh] relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>How we will make money</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] justify-center container">
        <div className="px-4 md:px-0 pt-20 md:pt-0 pb-28 md:pb-0">
          <div className="mb-4">
            <h2 className="text-2xl">Tiers</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-8 px-0 md:px-0 md:pt-0 md:mb-[80px] mb-12">
            <Card className="pb-8">
              <span className="py-1 px-4 bg-white text-black rounded-lg text-sm font-medium mb-4">
                Base
              </span>
              <h2 className="text-2xl">Free</h2>
              <p className="text-[#878787] text-sm text-center">
                We offer a free plan for users to get to know the platform.
              </p>
            </Card>

            <Card className="pb-8">
              <span className="py-1 px-4 border border-border rounded-lg text-sm font-medium mb-4">
                Pro
              </span>
              <h2 className="text-2xl">TBD/ mo</h2>
              <p className="text-[#878787] text-sm text-center">
                Launch pricing for growing teams.
              </p>
            </Card>

            <Card className="pb-8">
              <span className="py-1 px-4 border border-border rounded-lg text-sm font-medium mb-4">
                Enterprise
              </span>
              <h2 className="text-2xl">TBD</h2>
              <p className="text-[#878787] text-sm text-center">
                Licensed package for larger organizations and advanced workflows.
              </p>
            </Card>
          </div>

          <div className="mb-4">
            <h2 className="text-2xl">Add ons</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-8 px-0 md:px-0 md:pt-0">
            <Card className="pb-8">
              <h2>Team seats</h2>
              <p className="text-[#878787] text-sm text-center">
                Additional team members are priced per seat.
              </p>
            </Card>

            <Card className="pb-8">
              <h2>Vault storage</h2>
              <p className="text-[#878787] text-sm text-center">
                Additional storage above plan limits is available as a paid add-on.
              </p>
            </Card>

            <Card className="pb-8">
              <h2>Custom domain</h2>
              <p className="text-[#878787] text-sm text-center">
                Custom inbox identity can be provided for an additional fee.
              </p>
            </Card>
          </div>

          <div className="px-0 md:px-0">
            <a href="https://solnuv.com" target="_blank" rel="noreferrer" className="block">
              <div className="ful-w p-4 border border-border bg-[#121212] px-6 mt-8 text-center flex flex-col justify-center items-center space-y-4 pb-8">
                <h2>Engine</h2>
                <p className="text-[#878787] text-sm text-center max-w-[800px]">
                  SolNuv Engine streamlines integrations with one unified API and
                  UI layer.
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
