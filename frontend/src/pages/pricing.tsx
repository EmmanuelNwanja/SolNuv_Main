import Head from "next/head";
import Link from "next/link";
import { RiArrowRightLine, RiCheckLine } from "react-icons/ri";
import { MotionItem, MotionSection, MotionStagger } from "../components/PageMotion";
import { getPublicLayout } from "../components/Layout";

const PUBLIC_PRICING = [
  {
    name: "Basic",
    price: "₦15,000",
    period: "/month",
    cta: "Start Basic",
    href: "/register",
    features: [
      "Solar + storage design workspace",
      "Project and asset logging",
      "Core financial scenario analysis",
      "Guided lifecycle planning",
    ],
  },
  {
    name: "Pro",
    price: "₦40,000",
    period: "/month",
    popular: true,
    cta: "Choose Pro",
    href: "/register?plan=pro",
    features: [
      "Everything in Basic",
      "Advanced simulation and reports",
      "AI design expert guidance",
      "Team workflows for growing operators",
    ],
  },
  {
    name: "Elite",
    price: "₦100,000",
    period: "/month",
    cta: "Go Elite",
    href: "/register?plan=elite",
    features: [
      "Everything in Pro",
      "Compliance-focused workflows",
      "Priority support and onboarding",
      "Multi-team operational controls",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "engagement",
    cta: "Talk to sales",
    href: "/contact",
    features: [
      "Custom integrations and controls",
      "Portfolio-level governance workflows",
      "Dedicated account collaboration",
      "Tailored onboarding and advisory",
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <Head>
        <title>Pricing — SolNuv | Plans for Solar Teams and Partners</title>
        <meta
          name="description"
          content="Explore SolNuv pricing plans for solar teams, project operators, and enterprise partners. Choose the workflow tier that matches your design, compliance, and lifecycle needs."
        />
      </Head>

      <MotionSection className="marketing-section-dark marketing-section-animated">
        <MotionStagger className="text-center max-w-3xl mx-auto" delay={0.02}>
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Pricing</span>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mt-3 leading-tight">
            Transparent plans for dependable solar operations
          </h1>
          <p className="text-white/75 mt-4 text-base md:text-lg">
            Naira-first pricing for teams building, operating, and governing solar lifecycle workflows.
          </p>
          <div className="marketing-cta-row justify-center">
            <Link href="/register" className="btn-amber inline-flex items-center gap-2">
              Create account <RiArrowRightLine />
            </Link>
            <Link href="/contact" className="btn-outline border-white/30 text-white hover:bg-white/10">
              Contact enterprise sales
            </Link>
          </div>
        </MotionStagger>
      </MotionSection>

      <MotionSection className="marketing-section marketing-section-animated">
        <MotionStagger className="grid md:grid-cols-2 xl:grid-cols-4 gap-5" delay={0.04}>
          {PUBLIC_PRICING.map((plan) => (
            <MotionItem
              key={plan.name}
              className={`rounded-2xl overflow-hidden reveal-lift ${plan.popular ? "ring-2 ring-forest-900 shadow-xl" : "border border-slate-200"}`}
            >
              {plan.popular && (
                <div className="bg-forest-900 text-center py-1.5 text-xs font-bold text-amber-400">MOST POPULAR</div>
              )}
              <div className="p-6 bg-white h-full flex flex-col">
                <h2 className="font-display text-xl font-bold text-forest-900">{plan.name}</h2>
                <div className="mt-3 mb-5">
                  <p className="font-display text-3xl font-bold text-forest-900">{plan.price}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{plan.period}</p>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                      <RiCheckLine className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.popular ? "btn-primary" : "btn-outline"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </MotionItem>
          ))}
        </MotionStagger>
        <p className="text-sm text-slate-500 mt-6">
          Need full plan logic, promo handling, or payment method selection? Sign in to access the workspace billing flow.
        </p>
      </MotionSection>
    </>
  );
}

PricingPage.getLayout = getPublicLayout;
