const BILLING_INTERVALS = ['monthly', 'annual'];

// Plan hierarchy: used across middlewares for level comparisons
const { PLAN_HIERARCHY } = require('../constants/planConstants');

const PLAN_LIMITS = {
  free: 1,
  basic: 1,
  pro: 5,
  elite: 15,
  enterprise: 50,
};

// Calculator limits
const FREE_CALC_TOTAL_LIMIT = 6;     // free tier: 6 total uses / month across all types
const BASIC_CALC_TOTAL_LIMIT = 54;   // basic tier: 54 total uses / month across all types
const CALC_TYPES = ['panel', 'battery', 'degradation', 'roi', 'battery-soh', 'cable-size'];

const PLAN_DEFINITIONS = {
  free: {
    id: 'free',
    name: 'Free',
    monthly_price_ngn: 0,
    annual_price_ngn: 0,
    features: [
      'Account login & dashboard',
      'Unlimited project logging',
      '6 calculator uses/month (all tools)',
      'West African degradation data',
    ],
    cta: 'Current Plan',
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    monthly_price_ngn: 15000,
    annual_price_ngn: 162000,
    features: [
      'Unlimited project logging',
      'Solar+BESS system design',
      'Satellite irradiance data access',
      'Decommission predictions',
      '54 calculator uses/month',
      'Basic financial modelling',
      'SolNuv AI Assistant',
      '1 user / 1 device',
    ],
    cta: 'Get Basic',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthly_price_ngn: 40000,
    annual_price_ngn: 432000,
    popular: true,
    features: [
      'Everything in Basic',
      'Unlimited design simulations & load profiles',
      'NESREA EPR Compliance PDF Reports (coming soon)',
      'Cradle-to-Grave Certificates',
      'CSV & Excel export',
      'QR code traceability per project',
      'Custom public portfolio page',
      'SolNuv AI Assistant — enhanced solar guidance',
      'Team access (up to 5 users)',
      'Email support',
    ],
    cta: 'Start Pro',
  },
  elite: {
    id: 'elite',
    name: 'Elite',
    monthly_price_ngn: 100000,
    annual_price_ngn: 1080000,
    features: [
      'Everything in Pro',
      'Auto-send reports to NESREA',
      'ROI Proposal PDF + Cable Compliance PDF',
      'System Schematic Diagram (wiring & single-line)',
      'Team access (up to 15 users)',
      'Priority support + onboarding call',
      'Advanced leaderboard insights',
      '4 AI Customer Agents (Project Manager, Financial Advisor, Compliance Officer, Report Specialist)',
      'Featured installer badge',
    ],
    cta: 'Go Elite',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthly_price_ngn: 250000,
    annual_price_ngn: 2700000,
    features: [
      'Everything in Elite',
      'Custom API integrations',
      'Team access (up to 50 users)',
      'Dedicated account manager',
      'All AI Customer Agents + priority processing & async tasks',
      'Quarterly EPR advisory sessions',
      'White-label PDF reports',
      'Custom compliance reporting',
    ],
    cta: 'Contact Sales',
  },
};

const PAID_PLAN_IDS = ['basic', 'pro', 'elite', 'enterprise'];

function getPlanPrice(planId, interval = 'monthly') {
  const def = PLAN_DEFINITIONS[planId];
  if (!def) return 0;
  return interval === 'annual' ? def.annual_price_ngn : def.monthly_price_ngn;
}

function getPlanDurationMonths(interval = 'monthly') {
  return interval === 'annual' ? 12 : 1;
}

function getPlanCatalogForClient() {
  return Object.values(PLAN_DEFINITIONS).map((plan) => ({
    id: plan.id,
    name: plan.name,
    monthly_price_ngn: plan.monthly_price_ngn,
    annual_price_ngn: plan.annual_price_ngn,
    monthly_price_display: plan.monthly_price_ngn
      ? `N${plan.monthly_price_ngn.toLocaleString('en-NG')}/mo`
      : 'N0/mo',
    annual_price_display: plan.annual_price_ngn
      ? `N${plan.annual_price_ngn.toLocaleString('en-NG')}/yr`
      : 'N0/yr',
    annual_savings_percent: plan.monthly_price_ngn > 0 ? 10 : 0,
    annual_savings_ngn: plan.monthly_price_ngn > 0
      ? (plan.monthly_price_ngn * 12) - plan.annual_price_ngn
      : 0,
    popular: Boolean((plan as { popular?: boolean }).popular),
    features: plan.features,
    limits: { team_members: PLAN_LIMITS[plan.id] || 1 },
    cta: plan.cta,
  }));
}

module.exports = {
  BILLING_INTERVALS,
  PLAN_HIERARCHY,
  PLAN_LIMITS,
  PLAN_DEFINITIONS,
  PAID_PLAN_IDS,
  FREE_CALC_TOTAL_LIMIT,
  BASIC_CALC_TOTAL_LIMIT,
  CALC_TYPES,
  getPlanPrice,
  getPlanDurationMonths,
  getPlanCatalogForClient,
};
