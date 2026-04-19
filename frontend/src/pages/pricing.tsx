import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RiArrowRightLine, RiCheckLine } from "react-icons/ri";
import { MotionItem, MotionSection, MotionStagger } from "../components/PageMotion";
import { getPublicLayout } from "../components/Layout";
import PlanFeatureMatrix from "../components/PlanFeatureMatrix";
import {
  FALLBACK_CATALOG,
  fetchPlanCatalog,
  mapCatalogToPricingCards,
  type PlanCatalogEntry,
  type PricingCard,
} from "../utils/planCatalog";
import { trackEvent } from "../utils/telemetry";

const FALLBACK_CARDS: PricingCard[] = mapCatalogToPricingCards(FALLBACK_CATALOG);

export default function PricingPage() {
  const [catalog, setCatalog] = useState<PlanCatalogEntry[]>(FALLBACK_CATALOG);
  const [cards, setCards] = useState<PricingCard[]>(FALLBACK_CARDS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    trackEvent("pricing_viewed", { source: "public_pricing_page" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPlanCatalog()
      .then((fetched) => {
        if (cancelled) return;
        const mapped = mapCatalogToPricingCards(fetched);
        if (mapped.length > 0) {
          setCatalog(fetched);
          setCards(mapped);
          setLoadError(false);
        } else {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          <h1 className="marketing-hero-dark-title mt-3">
            Transparent plans for dependable solar operations
          </h1>
          <p className="text-white/75 mt-4 text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-1">
            Naira-first pricing for teams building, operating, and governing solar lifecycle workflows.
          </p>
          <div className="marketing-cta-row justify-center">
            <Link href="/register" className="btn-amber inline-flex items-center gap-2">
              Create account <RiArrowRightLine />
            </Link>
            <Link href="/contact" className="btn-on-dark">
              Contact enterprise sales
            </Link>
          </div>
        </MotionStagger>
      </MotionSection>

      <MotionSection className="marketing-section marketing-section-animated">
        {loadError && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 max-w-3xl mx-auto text-center">
            We couldn&apos;t load the latest pricing just now, so we&apos;re showing our standard tiers. Refresh to retry.
          </p>
        )}
        <MotionStagger className="grid md:grid-cols-2 xl:grid-cols-4 gap-5" delay={0.04}>
          {cards.map((plan) => (
            <MotionItem
              key={plan.id}
              className={`rounded-2xl overflow-hidden reveal-lift ${plan.popular ? "ring-2 ring-forest-900 shadow-xl" : "border border-slate-200"}`}
            >
              {plan.popular && (
                <div className="bg-forest-900 text-center py-1.5 text-xs font-bold text-amber-400">MOST POPULAR</div>
              )}
              <div className="p-6 bg-white h-full flex flex-col">
                <h2 className="font-display text-xl font-bold text-forest-900">{plan.name}</h2>
                <div className="mt-3 mb-5">
                  <p className="font-display text-3xl font-bold text-forest-900">{plan.priceLabel}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{plan.period}</p>
                  {plan.monthlyNgn > 0 && plan.annualNgn > 0 && (
                    <p className="text-[11px] text-emerald-600 mt-1">
                      or ₦{plan.annualNgn.toLocaleString("en-NG")}/year (10% off)
                    </p>
                  )}
                  {plan.teamSeats > 1 && (
                    <p className="text-[11px] text-slate-400 mt-0.5">Up to {plan.teamSeats} team members</p>
                  )}
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
                  href={plan.ctaHref}
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.popular ? "btn-primary" : "btn-outline"
                  }`}
                >
                  {plan.ctaLabel}
                </Link>
              </div>
            </MotionItem>
          ))}
        </MotionStagger>
        <div className="mt-6 text-sm text-slate-500 space-y-2">
          <p>
            {loading
              ? "Loading the latest plan details..."
              : "Sign in to access the full billing flow with promo codes, annual billing, and secure receipt upload."}
          </p>
          <p className="text-xs text-slate-400">
            Direct Bank Transfer is the active payment method today; card and USSD payments via Paystack are coming soon.
            Plans activate within 24 hours of receipt verification.
          </p>
        </div>

        <PlanFeatureMatrix catalog={catalog} />
      </MotionSection>
    </>
  );
}

PricingPage.getLayout = getPublicLayout;
