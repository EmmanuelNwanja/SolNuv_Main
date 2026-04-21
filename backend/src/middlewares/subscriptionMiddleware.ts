/**
 * SolNuv Subscription Middleware
 * Enforces plan-based access to premium features
 */

const { sendError } = require('../utils/responseHelper');
const { PLAN_HIERARCHY, PLAN_LIMITS } = require('../services/billingService');
const { isSubscriptionHardExpired } = require('../services/gracePeriodService');

const PLAN_HIERARCHY_LOCAL = PLAN_HIERARCHY; // { free:0, basic:1, pro:2, elite:3, enterprise:4 }

/**
 * Require minimum subscription plan
 * @param {string} minPlan - 'free' | 'basic' | 'pro' | 'elite' | 'enterprise'
 */
function requirePlan(minPlan) {
  return (req, res, next) => {
    if (!req.user) return sendError(res, 'Authentication required', 401);

    // Get subscription plan from company if available, otherwise from user record
    // req.company is set by authMiddleware and is the preferred source
    const company = req.company || req.user.companies;
    const rawPlan = company?.subscription_plan || req.user.subscription_plan || 'free';
    const userPlan = String(rawPlan).toLowerCase().trim();
    const userPlanLevel = PLAN_HIERARCHY_LOCAL[userPlan] ?? 0;
    const requiredLevel = PLAN_HIERARCHY_LOCAL[minPlan] ?? 0;

    // Grace period: use shared helper so expiry logic stays in one place.
    if (isSubscriptionHardExpired(company)) {
      return sendError(res, 'Your subscription has expired. Please renew to access this feature.', 402, {
        code: 'SUBSCRIPTION_EXPIRED',
        upgrade_url: 'https://solnuv.com/plans',
      });
    }

    if (userPlanLevel < requiredLevel) {
      return sendError(res, `This feature requires the ${minPlan.charAt(0).toUpperCase() + minPlan.slice(1)} plan or higher.`, 403, {
        code: 'PLAN_UPGRADE_REQUIRED',
        current_plan: userPlan,
        required_plan: minPlan,
        upgrade_url: 'https://solnuv.com/plans',
      });
    }

    next();
  };
}

/**
 * Check team member limits before adding new members
 */
async function checkTeamLimit(req, res, next) {
  if (!req.user || !req.user.company_id) return next();

  const supabase = require('../config/database');

  // req.user.companies may be undefined when the auth middleware fell back to the
  // plain (no-join) query path.  Always resolve from the DB so the limit is enforced.
  let company = req.user.companies;
  if (!company) {
    const { data } = await supabase
      .from('companies')
      .select('id, subscription_plan, max_team_members')
      .eq('id', req.user.company_id)
      .maybeSingle();
    company = data;
  }

  if (!company) return next();

  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id);

  const isPartnerUserType = ['recycler', 'financier', 'training_institute'].includes(String(req.user.user_type || ''));
  const planCap = company.max_team_members || PLAN_LIMITS[company.subscription_plan] || 1;
  const maxMembers = isPartnerUserType ? Math.max(planCap, 2) : planCap;

  if (count >= maxMembers) {
    return sendError(res, `Your ${company.subscription_plan} plan allows a maximum of ${maxMembers} team members. Upgrade to add more.`, 403, {
      code: 'TEAM_LIMIT_REACHED',
      current: count,
      max: maxMembers,
      upgrade_url: 'https://solnuv.com/plans',
    });
  }

  next();
}

module.exports = { requirePlan, checkTeamLimit };
