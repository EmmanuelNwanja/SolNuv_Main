const BILLING_INTERVALS = ['monthly', 'annual'];

const PLAN_LIMITS = {
  free: 1,
  pro: 5,
  elite: 15,
  enterprise: 50,
};

const PLAN_DEFINITIONS = {
  free: {
    id: 'free',
    name: 'Free',
    monthly_price_ngn: 0,
    annual_price_ngn: 0,
    features: [
      'Unlimited project logging',
      'West African decommission predictions',
      'Silver value calculator',
      'Email decommission alerts',
      '1 user / 1 device',
    ],
    cta: 'Get Started Free',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthly_price_ngn: 15000,
    annual_price_ngn: 162000,
    popular: true,
    features: [
      'Everything in Free',
      'NESREA EPR Compliance PDF Reports',
      'Cradle-to-Grave Certificates',
      'Excel export + recovery analytics',
      'QR code traceability per project',
      'Team access (up to 5 users)',
      'Email support',
    ],
    cta: 'Start Pro',
  },
  elite: {
    id: 'elite',
    name: 'Elite',
    monthly_price_ngn: 35000,
    annual_price_ngn: 378000,
    features: [
      'Everything in Pro',
      'Auto-send reports to NESREA',
      'Team access (up to 15 users)',
      'Priority support + onboarding',
      'Advanced leaderboard insights',
    ],
    cta: 'Go Elite',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthly_price_ngn: 90000,
    annual_price_ngn: 972000,
    features: [
      'Everything in Elite',
      'Custom integrations',
      'Team access (up to 50 users)',
      'Dedicated account manager',
      'Quarterly compliance advisory',
    ],
    cta: 'Contact Sales',
  },
};

const PAID_PLAN_IDS = ['pro', 'elite', 'enterprise'];

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
    popular: !!plan.popular,
    features: plan.features,
    limits: { team_members: PLAN_LIMITS[plan.id] || 1 },
    cta: plan.cta,
  }));
}

module.exports = {
  BILLING_INTERVALS,
  PLAN_LIMITS,
  PLAN_DEFINITIONS,
  PAID_PLAN_IDS,
  getPlanPrice,
  getPlanDurationMonths,
  getPlanCatalogForClient,
};
