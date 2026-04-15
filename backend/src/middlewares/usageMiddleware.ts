/**
 * SolNuv Calculator Usage Middleware
 * Free tier : 6 total calculator uses per month across all tool types.
 * Basic     : 54 total calculator uses per month across all tool types.
 * Pro+      : Unlimited calculator uses.
 * Simulation: Blocked for free tier. Basic: 3/month. Pro+: unlimited.
 */

const supabase = require('../config/database');
const { sendError } = require('../utils/responseHelper');
const { PLAN_HIERARCHY, FREE_CALC_TOTAL_LIMIT, BASIC_CALC_TOTAL_LIMIT } = require('../services/billingService');

/**
 * Returns { year, month } for the current billing period.
 */
function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * Middleware factory: track + optionally limit calculator usage by type.
 * @param {string} calcType  One of: panel | battery | degradation | roi | battery-soh | cable-size
 */
function trackCalculatorUsage(calcType) {
  return async (req, res, next) => {
    // Anonymous users (no token) — homepage demo, no tracking or limits applied.
    if (!req.user) return next();

    const user = req.user;
    const companyId = req.company?.id || user.company_id || null;
    const userPlan = req.company?.subscription_plan || user.subscription_plan || 'free';
    const planLevel = PLAN_HIERARCHY[userPlan] ?? 0;

    // Pro+ : no calc limits
    if (planLevel >= 2) return next();

    // Free (6) or Basic (54): check TOTAL usage across all calc types this month
    const calcLimit = planLevel === 1 ? BASIC_CALC_TOTAL_LIMIT : FREE_CALC_TOTAL_LIMIT;

    // Free / Basic — check TOTAL usage across all calc types this month
    const { year, month } = currentPeriod();
    const userId = user.supabase_uid || user.id;

    try {
      const { data: allRows } = await supabase
        .from('calculator_usage')
        .select('use_count')
        .eq('user_id', userId)
        .eq('period_year', year)
        .eq('period_month', month);

      const totalUsed = (allRows || []).reduce((sum, r) => sum + (r.use_count || 0), 0);

      if (totalUsed >= calcLimit) {
        const msg = planLevel === 1
          ? `You've used all ${BASIC_CALC_TOTAL_LIMIT} Basic calculator uses for this month. Upgrade to Pro for unlimited access.`
          : `You've used your ${FREE_CALC_TOTAL_LIMIT} free calculator uses for this month. Subscribe to Basic for more access.`;
        return sendError(res, msg, 429, {
          code: 'CALC_LIMIT_EXCEEDED',
          calc_type: calcType,
          limit: calcLimit,
          used: totalUsed,
          period: `${year}-${String(month).padStart(2, '0')}`,
          upgrade_url: 'https://solnuv.com/plans',
        });
      }

      // Increment usage for this specific type (for per-tool analytics)
      const { data: existing } = await supabase
        .from('calculator_usage')
        .select('use_count')
        .eq('user_id', userId)
        .eq('calc_type', calcType)
        .eq('period_year', year)
        .eq('period_month', month)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('calculator_usage')
          .update({ use_count: (existing.use_count || 0) + 1, last_used_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('calc_type', calcType)
          .eq('period_year', year)
          .eq('period_month', month);
      } else {
        await supabase
          .from('calculator_usage')
          .insert({
            user_id: userId,
            company_id: companyId,
            calc_type: calcType,
            period_year: year,
            period_month: month,
            use_count: 1,
          });
      }

      req.calcUsage = { used: totalUsed + 1, limit: calcLimit, remaining: calcLimit - (totalUsed + 1) };
    } catch (err) {
      // On DB error, allow the calculation to proceed (don't block on tracking failure)
    }

    next();
  };
}

/**
 * GET /api/calculator/usage  — return current month usage for authenticated user
 */
async function getCalculatorUsage(req, res) {
  if (!req.user) {
    return res.json({ data: { authenticated: false, usage: {} } });
  }

  const { year, month } = currentPeriod();
  const userId = req.user.supabase_uid || req.user.id;

  try {
    const { data: rows } = await supabase
      .from('calculator_usage')
      .select('calc_type, use_count')
      .eq('user_id', userId)
      .eq('period_year', year)
      .eq('period_month', month);

    const usage = {};
    let totalUsed = 0;
    for (const row of rows || []) {
      usage[row.calc_type] = row.use_count;
      totalUsed += row.use_count || 0;
    }

    const userPlan = req.company?.subscription_plan || req.user?.subscription_plan || 'free';
    const planLevel = PLAN_HIERARCHY[userPlan] ?? 0;
    const isFree = planLevel === 0;
    const isBasic = planLevel === 1;
    const calcLimit = isFree ? FREE_CALC_TOTAL_LIMIT : isBasic ? BASIC_CALC_TOTAL_LIMIT : null;

    return res.json({
      data: {
        authenticated: true,
        plan: userPlan,
        is_limited: planLevel <= 1,
        total_used: totalUsed,
        total_limit: calcLimit,
        total_remaining: calcLimit != null ? Math.max(0, calcLimit - totalUsed) : null,
        period: `${year}-${String(month).padStart(2, '0')}`,
        usage,
      },
    });
  } catch {
    return res.json({ data: { authenticated: true, usage: {} } });
  }
}

/**
 * Middleware: track + limit simulation/load-profile usage.
 * Free tier : Blocked entirely (requires requirePlan('basic') on the route).
 * Basic     : 3 design runs per month (shared across simulation + load-profile actions).
 * Pro+      : Unlimited.
 * @param {string} actionType  'simulation' | 'load_profile' | 'auto_size'
 */
const SIMULATION_LIMIT_PER_MONTH = 3;

function trackSimulationUsage(actionType = 'simulation') {
  return async (req, res, next) => {
    if (!req.user) return sendError(res, 'Authentication required', 401);

    const user = req.user;
    const companyId = req.company?.id || user.company_id || null;
    const userPlan = req.company?.subscription_plan || user.subscription_plan || 'free';
    const planLevel = PLAN_HIERARCHY[userPlan] ?? 0;

    // Pro+ plans are unrestricted
    if (planLevel >= 2) return next();

    // Basic plan — check + increment monthly usage
    const { year, month } = currentPeriod();
    const calcType = `design_${actionType}`; // e.g. design_simulation, design_load_profile

    try {
      const { data: existing } = await supabase
        .from('calculator_usage')
        .select('use_count')
        .eq('user_id', user.supabase_uid || user.id)
        .eq('calc_type', calcType)
        .eq('period_year', year)
        .eq('period_month', month)
        .maybeSingle();

      const currentCount = existing?.use_count ?? 0;

      if (currentCount >= SIMULATION_LIMIT_PER_MONTH) {
        return sendError(
          res,
          `You've used your ${SIMULATION_LIMIT_PER_MONTH} Basic-plan ${actionType.replace('_', ' ')} runs for this month. Upgrade to Pro for unlimited access.`,
          429,
          {
            code: 'SIMULATION_LIMIT_EXCEEDED',
            action_type: actionType,
            limit: SIMULATION_LIMIT_PER_MONTH,
            used: currentCount,
            period: `${year}-${String(month).padStart(2, '0')}`,
            upgrade_url: 'https://solnuv.com/plans',
          }
        );
      }

      if (existing) {
        await supabase
          .from('calculator_usage')
          .update({ use_count: currentCount + 1, last_used_at: new Date().toISOString() })
          .eq('user_id', user.supabase_uid || user.id)
          .eq('calc_type', calcType)
          .eq('period_year', year)
          .eq('period_month', month);
      } else {
        await supabase
          .from('calculator_usage')
          .insert({
            user_id: user.supabase_uid || user.id,
            company_id: companyId,
            calc_type: calcType,
            period_year: year,
            period_month: month,
            use_count: 1,
          });
      }

      req.simulationUsage = { used: currentCount + 1, limit: SIMULATION_LIMIT_PER_MONTH, remaining: SIMULATION_LIMIT_PER_MONTH - (currentCount + 1) };
    } catch (err) {
      // On DB error, allow the action to proceed
    }

    next();
  };
}

module.exports = { trackCalculatorUsage, getCalculatorUsage, trackSimulationUsage };
