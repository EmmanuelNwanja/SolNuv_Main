import Link from "next/link";
import { Card } from "./ui";

export function SectionSubscription() {
  return (
    <div className="min-h-[100svh] md:h-[100svh] md:overflow-hidden relative w-full">
      <div className="absolute left-4 right-4 md:left-8 md:right-8 top-4 flex justify-between text-sm md:text-lg">
        <span>Commercial model</span>
        <span className="text-[#878787]">
          <Link href="/">solnuv.com</Link>
        </span>
      </div>
      <div className="flex flex-col min-h-[100svh] md:h-[100svh] justify-center container">
        <div className="px-4 md:px-0 pt-20 md:pt-10 lg:pt-8 pb-28 md:pb-4 max-w-[1280px] mx-auto md:origin-top md:scale-[0.9] lg:scale-[0.95] xl:scale-100">
          <div className="mb-4">
            <h2 className="text-2xl font-display text-emerald-100">Plans</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-5 xl:gap-8 px-0 md:px-0 md:pt-0 md:mb-8 xl:mb-[80px] mb-12 items-stretch">
            <Card className="pb-8 border-emerald-500/35 bg-forest-900/30">
              <span className="py-1 px-4 bg-emerald-300 text-forest-900 rounded-lg text-sm font-medium mb-4">
                Starter
              </span>
              <h2 className="text-2xl font-display text-emerald-100">Starter</h2>
              <p className="text-emerald-50/75 text-sm text-center">
                Core workspace access, calculators, and onboarding—designed to earn trust before upsell.
              </p>
            </Card>

            <Card className="pb-8 border-amber-500/35 bg-amber-900/15">
              <span className="py-1 px-4 border border-amber-300/60 text-amber-100 rounded-lg text-sm font-medium mb-4">
                Pro
              </span>
              <h2 className="text-2xl font-display text-amber-100">Team scale</h2>
              <p className="text-amber-50/75 text-sm text-center">
                Higher limits, AI advisor throughput, and collaboration controls for growing portfolios.
              </p>
            </Card>

            <Card className="pb-8 border-emerald-500/25 bg-slate-900/80">
              <span className="py-1 px-4 border border-slate-300/40 text-slate-100 rounded-lg text-sm font-medium mb-4">
                Enterprise
              </span>
              <h2 className="text-2xl font-display text-slate-100">Programs & partners</h2>
              <p className="text-slate-300 text-sm text-center">
                Verification bundles, partner rails, security review, and custom reporting for institutions.
              </p>
            </Card>
          </div>

          <div className="mb-4">
            <h2 className="text-2xl font-display text-amber-100">Add-ons</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-5 xl:gap-8 px-0 md:px-0 md:pt-0 items-stretch">
            <Card className="pb-8 border-emerald-500/30 bg-slate-900/80">
              <h2 className="font-display text-emerald-100">Partner seats</h2>
              <p className="text-slate-300 text-sm text-center">
                Expand recycler, financier, or training-institute workspaces as programs adopt SolNuv.
              </p>
            </Card>

            <Card className="pb-8 border-amber-500/30 bg-slate-900/90">
              <h2 className="font-display text-amber-100">Verification packs</h2>
              <p className="text-slate-300 text-sm text-center">
                Project and competency verification volume for enterprises and institute networks.
              </p>
            </Card>

            <Card className="pb-8 border-emerald-500/20 bg-slate-900/80">
              <h2 className="font-display text-slate-100">API & integrations</h2>
              <p className="text-slate-300 text-sm text-center">
                Connect ERP, asset registries, and partner systems to the same evidence graph.
              </p>
            </Card>
          </div>

          <div className="px-0 md:px-0">
            <a href="https://solnuv.com" target="_blank" rel="noreferrer" className="block">
              <div className="w-full p-4 border border-emerald-500/25 bg-[#121212] px-6 mt-8 text-center flex flex-col justify-center items-center space-y-4 pb-8">
                <h2 className="font-display text-emerald-100">SolNuv graph</h2>
                <p className="text-slate-300 text-sm text-center max-w-[800px]">
                  Every approval, verification, and lifecycle event strengthens a reusable data graph—the real long-term moat behind the AI-native multiple.
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
