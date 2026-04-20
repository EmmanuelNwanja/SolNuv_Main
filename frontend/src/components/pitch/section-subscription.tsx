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
            <h2 className="text-2xl font-display text-emerald-100">Tiers</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-8 px-0 md:px-0 md:pt-0 md:mb-[80px] mb-12">
            <Card className="pb-8 border-emerald-500/35 bg-forest-900/30">
              <span className="py-1 px-4 bg-emerald-300 text-forest-900 rounded-lg text-sm font-medium mb-4">
                Base
              </span>
              <h2 className="text-2xl font-display text-emerald-100">Free</h2>
              <p className="text-emerald-50/75 text-sm text-center">
                We offer a free plan for users to get to know the platform.
              </p>
            </Card>

            <Card className="pb-8 border-amber-500/35 bg-amber-900/15">
              <span className="py-1 px-4 border border-amber-300/60 text-amber-100 rounded-lg text-sm font-medium mb-4">
                Pro
              </span>
              <h2 className="text-2xl font-display text-amber-100">TBD/ mo</h2>
              <p className="text-amber-50/75 text-sm text-center">
                Launch pricing for growing teams.
              </p>
            </Card>

            <Card className="pb-8 border-emerald-500/25 bg-slate-900/80">
              <span className="py-1 px-4 border border-slate-300/40 text-slate-100 rounded-lg text-sm font-medium mb-4">
                Enterprise
              </span>
              <h2 className="text-2xl font-display text-slate-100">TBD</h2>
              <p className="text-slate-300 text-sm text-center">
                Licensed package for larger organizations and advanced workflows.
              </p>
            </Card>
          </div>

          <div className="mb-4">
            <h2 className="text-2xl font-display text-amber-100">Add ons</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-8 px-0 md:px-0 md:pt-0">
            <Card className="pb-8 border-emerald-500/30 bg-slate-900/80">
              <h2 className="font-display text-emerald-100">Team seats</h2>
              <p className="text-slate-300 text-sm text-center">
                Additional team members are priced per seat.
              </p>
            </Card>

            <Card className="pb-8 border-amber-500/30 bg-slate-900/90">
              <h2 className="font-display text-amber-100">Vault storage</h2>
              <p className="text-slate-300 text-sm text-center">
                Additional storage above plan limits is available as a paid add-on.
              </p>
            </Card>

            <Card className="pb-8 border-emerald-500/20 bg-slate-900/80">
              <h2 className="font-display text-slate-100">Custom domain</h2>
              <p className="text-slate-300 text-sm text-center">
                Custom inbox identity can be provided for an additional fee.
              </p>
            </Card>
          </div>

          <div className="px-0 md:px-0">
            <a href="https://solnuv.com" target="_blank" rel="noreferrer" className="block">
              <div className="ful-w p-4 border border-emerald-500/25 bg-[#121212] px-6 mt-8 text-center flex flex-col justify-center items-center space-y-4 pb-8">
                <h2 className="font-display text-emerald-100">Engine</h2>
                <p className="text-slate-300 text-sm text-center max-w-[800px]">
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
