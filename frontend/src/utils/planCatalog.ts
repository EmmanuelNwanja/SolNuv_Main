import { paymentsAPI } from "../services/api";

export interface PlanLimits {
  team_members: number;
  calculator_uses_per_month: number | null;
  simulations_per_month: number | null;
}

export interface PlanCatalogEntry {
  id: string;
  name: string;
  monthly_price_ngn: number;
  annual_price_ngn: number;
  monthly_price_display: string;
  annual_price_display: string;
  annual_savings_percent: number;
  annual_savings_ngn: number;
  popular: boolean;
  features: string[];
  limits: PlanLimits;
  cta: string;
}

export interface PricingCard {
  id: string;
  name: string;
  priceLabel: string;
  period: string;
  monthlyNgn: number;
  annualNgn: number;
  teamSeats: number;
  popular: boolean;
  ctaLabel: string;
  ctaHref: string;
  features: string[];
}

const FALLBACK_CATALOG: PlanCatalogEntry[] = [
  {
    id: "basic",
    name: "Basic",
    monthly_price_ngn: 15000,
    annual_price_ngn: 162000,
    monthly_price_display: "N15,000/mo",
    annual_price_display: "N162,000/yr",
    annual_savings_percent: 10,
    annual_savings_ngn: 18000,
    popular: false,
    features: [
      "Unlimited project logging",
      "Solar+BESS system design",
      "Satellite irradiance data access",
      "54 calculator uses/month",
      "SolNuv AI Assistant",
      "1 user / 1 device",
    ],
    limits: { team_members: 1, calculator_uses_per_month: 54, simulations_per_month: 3 },
    cta: "Get Basic",
  },
  {
    id: "pro",
    name: "Pro",
    monthly_price_ngn: 40000,
    annual_price_ngn: 432000,
    monthly_price_display: "N40,000/mo",
    annual_price_display: "N432,000/yr",
    annual_savings_percent: 10,
    annual_savings_ngn: 48000,
    popular: true,
    features: [
      "Everything in Basic",
      "Unlimited design simulations & load profiles",
      "Cradle-to-Grave Certificates",
      "CSV & Excel export",
      "Custom public portfolio page",
      "Team access (up to 5 users)",
      "Email support",
    ],
    limits: { team_members: 5, calculator_uses_per_month: null, simulations_per_month: null },
    cta: "Start Pro",
  },
  {
    id: "elite",
    name: "Elite",
    monthly_price_ngn: 100000,
    annual_price_ngn: 1080000,
    monthly_price_display: "N100,000/mo",
    annual_price_display: "N1,080,000/yr",
    annual_savings_percent: 10,
    annual_savings_ngn: 120000,
    popular: false,
    features: [
      "Everything in Pro",
      "Auto-send reports to NESREA",
      "ROI Proposal PDF + Cable Compliance PDF",
      "System Schematic Diagram (wiring & single-line)",
      "Team access (up to 15 users)",
      "Priority support + onboarding call",
      "4 AI Customer Agents",
      "Featured installer badge",
    ],
    limits: { team_members: 15, calculator_uses_per_month: null, simulations_per_month: null },
    cta: "Go Elite",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly_price_ngn: 250000,
    annual_price_ngn: 2700000,
    monthly_price_display: "N250,000/mo",
    annual_price_display: "N2,700,000/yr",
    annual_savings_percent: 10,
    annual_savings_ngn: 300000,
    popular: false,
    features: [
      "Everything in Elite",
      "Custom API integrations",
      "Team access (up to 50 users)",
      "Dedicated account manager",
      "Quarterly EPR advisory sessions",
      "White-label PDF reports",
    ],
    limits: { team_members: 50, calculator_uses_per_month: null, simulations_per_month: null },
    cta: "Contact Sales",
  },
];

export function formatNairaDisplay(amount: number): string {
  if (!amount) return "₦0";
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

export async function fetchPlanCatalog(): Promise<PlanCatalogEntry[]> {
  try {
    const { data } = await paymentsAPI.getPlans();
    const plans = (data?.data?.plans || []) as PlanCatalogEntry[];
    if (!Array.isArray(plans) || plans.length === 0) return FALLBACK_CATALOG;
    return plans;
  } catch {
    return FALLBACK_CATALOG;
  }
}

/**
 * Shape a catalog entry into the card model used by public marketing pricing.
 * Keeps the "Enterprise" tier as contact-only and renders price as "Custom".
 */
export function mapCatalogToPricingCards(catalog: PlanCatalogEntry[]): PricingCard[] {
  return catalog
    .filter((plan) => plan.id !== "free")
    .map((plan) => {
      const isEnterprise = plan.id === "enterprise";
      const priceLabel = isEnterprise ? "Custom" : formatNairaDisplay(plan.monthly_price_ngn);
      const period = isEnterprise ? "engagement" : "/month";
      const ctaHref = isEnterprise
        ? "/contact"
        : plan.id === "basic"
          ? "/register"
          : `/register?plan=${encodeURIComponent(plan.id)}`;

      return {
        id: plan.id,
        name: plan.name,
        priceLabel,
        period,
        monthlyNgn: plan.monthly_price_ngn,
        annualNgn: plan.annual_price_ngn,
        teamSeats: plan.limits?.team_members ?? 1,
        popular: Boolean(plan.popular),
        ctaLabel: plan.cta || (isEnterprise ? "Talk to sales" : `Choose ${plan.name}`),
        ctaHref,
        features: Array.isArray(plan.features) ? plan.features : [],
      };
    });
}

export { FALLBACK_CATALOG };
