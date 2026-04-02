/**
 * SolNuv Calculator Usage Middleware
 * Tracks calculator usage and enforces per-type monthly limits for Free plan.
 *
 * Free plan: 2 uses per calculator type per month (6 types × 2 = 12 total)
 * Pro / Elite / Enterprise: Unlimited
 */

const supabase = require('../config/database');
const { sendError } = require('../utils/responseHelper');

const FREE_LIMIT_PER_TYPE = 2;
const PLAN_HIERARCHY = { free: 0, pro: 1, elite: 2, enterprise: 3 };

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

    // Paid plans are unrestricted
    if (planLevel > 0) return next();

    // Free plan — check + increment monthly usage for this type
    const { year, month } = currentPeriod();

    try {
      // Upsert usage counter (increment by 1 atomically using RPC)
      // Fallback: read-then-write with conflict handling
      const { data: existing } = await supabase
        .from('calculator_usage')
        .select('use_count')
        .eq('user_id', user.supabase_uid || user.id)
        .eq('calc_type', calcType)
        .eq('period_year', year)
        .eq('period_month', month)
        .maybeSingle();

      const currentCount = existing?.use_count ?? 0;

      if (currentCount >= FREE_LIMIT_PER_TYPE) {
        return sendError(
          res,
          `You've used your ${FREE_LIMIT_PER_TYPE} free ${calcType} calculations for this month. Upgrade to Pro for unlimited access.`,
          429,
          {
            code: 'CALC_LIMIT_EXCEEDED',
            calc_type: calcType,
            limit: FREE_LIMIT_PER_TYPE,
            used: currentCount,
            period: `${year}-${String(month).padStart(2, '0')}`,
            upgrade_url: 'https://solnuv.com/plans',
          }
        );
      }

      // Increment usage (upsert)
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

      // Attach usage info to request so controller can include it in response
      req.calcUsage = { used: currentCount + 1, limit: FREE_LIMIT_PER_TYPE, remaining: FREE_LIMIT_PER_TYPE - (currentCount + 1) };
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
    for (const row of rows || []) {
      usage[row.calc_type] = row.use_count;
    }

    const userPlan = req.company?.subscription_plan || req.user?.subscription_plan || 'free';
    const planLevel = PLAN_HIERARCHY[userPlan] ?? 0;

    return res.json({
      data: {
        authenticated: true,
        plan: userPlan,
        is_limited: planLevel === 0,
        limit_per_type: FREE_LIMIT_PER_TYPE,
        period: `${year}-${String(month).padStart(2, '0')}`,
        usage,
      },
    });
  } catch {
    return res.json({ data: { authenticated: true, usage: {} } });
  }
}

module.exports = { trackCalculatorUsage, getCalculatorUsage };
