/**
 * SolNuv Dashboard Controller
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { calculatePortfolioSilver } = require('../services/silverService');

/**
 * GET /api/dashboard
 * Main dashboard data
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;

    // Scope query
    const scopeFilter = companyId
      ? { field: 'company_id', value: companyId }
      : { field: 'user_id', value: userId };

    // Project counts by status
    const { data: projects } = await supabase
      .from('projects')
      .select(`
        id, status, state, city, name, estimated_decommission_date, installation_date,
        equipment(equipment_type, quantity, estimated_silver_grams, adjusted_failure_date)
      `)
      .eq(scopeFilter.field, scopeFilter.value);

    const allProjects = projects || [];
    const active = allProjects.filter(p => p.status === 'active');
    const decommissioned = allProjects.filter(p => p.status === 'decommissioned');
    const recycled = allProjects.filter(p => p.status === 'recycled');
    const pendingRecovery = allProjects.filter(p => p.status === 'pending_recovery');

    // Equipment totals
    let totalPanels = 0, totalBatteries = 0, totalSilverGrams = 0;

    for (const proj of allProjects) {
      for (const eq of proj.equipment || []) {
        if (eq.equipment_type === 'panel') {
          totalPanels += eq.quantity;
          totalSilverGrams += eq.estimated_silver_grams || 0;
        } else {
          totalBatteries += eq.quantity;
        }
      }
    }

    // Upcoming decommissions (next 12 months)
    const today = new Date();
    const oneYearLater = new Date(today);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const upcoming = active
      .filter(p => p.estimated_decommission_date)
      .map(p => {
        const decommDate = new Date(p.estimated_decommission_date);
        const daysUntil = Math.ceil((decommDate - today) / (1000 * 60 * 60 * 24));
        return { ...p, days_until_decommission: daysUntil };
      })
      .filter(p => p.days_until_decommission <= 365)
      .sort((a, b) => a.days_until_decommission - b.days_until_decommission)
      .slice(0, 5); // Top 5 closest

    // Silver portfolio value
    const silverPortfolio = await calculatePortfolioSilver(userId, companyId);

    // User's leaderboard rank
    const { data: leaderboard } = await supabase
      .from('leaderboard_cache')
      .select('rank_active, rank_recycled, rank_impact, impact_score')
      .eq('entity_id', userId)
      .single();

    // Recent activity (last 5 projects)
    const recent = allProjects
      .sort((a, b) => new Date(b.installation_date) - new Date(a.installation_date))
      .slice(0, 5);

    return sendSuccess(res, {
      stats: {
        active_projects: active.length,
        decommissioned: decommissioned.length,
        recycled: recycled.length,
        pending_recovery: pendingRecovery.length,
        total_projects: allProjects.length,
        total_panels: totalPanels,
        total_batteries: totalBatteries,
        total_silver_grams: parseFloat(totalSilverGrams.toFixed(4)),
      },
      silver_portfolio: silverPortfolio,
      upcoming_decommissions: upcoming,
      recent_projects: recent,
      leaderboard_rank: leaderboard || null,
      subscription_plan: req.user.companies?.subscription_plan || 'free',
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return sendError(res, 'Failed to load dashboard', 500);
  }
};

/**
 * GET /api/dashboard/impact
 * Impact calculator data
 */
exports.getImpact = async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    const scopeFilter = companyId ? { field: 'company_id', value: companyId } : { field: 'user_id', value: userId };

    const { data: projects } = await supabase
      .from('projects')
      .select('id, status, equipment(equipment_type, quantity, size_watts, capacity_kwh, estimated_silver_grams)')
      .eq(scopeFilter.field, scopeFilter.value);

    const allProjects = projects || [];
    const recycled = allProjects.filter(p => p.status === 'recycled');

    // Actual impact (recycled)
    let recycledPanels = 0, recycledBatteries = 0, recycledSilverGrams = 0;
    for (const proj of recycled) {
      for (const eq of proj.equipment || []) {
        if (eq.equipment_type === 'panel') {
          recycledPanels += eq.quantity;
          recycledSilverGrams += eq.estimated_silver_grams || 0;
        } else {
          recycledBatteries += eq.quantity;
        }
      }
    }

    // Expected impact (all active + decommissioned panels)
    let expectedPanels = 0, expectedSilverGrams = 0;
    for (const proj of allProjects) {
      for (const eq of proj.equipment || []) {
        if (eq.equipment_type === 'panel') {
          expectedPanels += eq.quantity;
          expectedSilverGrams += eq.estimated_silver_grams || 0;
        }
      }
    }

    // Environmental equivalents (example formulas)
    // Each panel avoids ~230kg CO2 over its lifetime
    const co2Avoided = recycledPanels * 230;

    return sendSuccess(res, {
      actual: {
        panels_recycled: recycledPanels,
        batteries_recycled: recycledBatteries,
        silver_recovered_grams: parseFloat(recycledSilverGrams.toFixed(4)),
        co2_avoided_kg: co2Avoided,
      },
      expected: {
        panels_to_recycle: expectedPanels,
        expected_silver_grams: parseFloat(expectedSilverGrams.toFixed(4)),
        expected_co2_avoided_kg: expectedPanels * 230,
      },
      silver_value_ngn: parseFloat((recycledSilverGrams * 0.35 * 1555).toFixed(2)),
    });
  } catch (error) {
    return sendError(res, 'Failed to calculate impact', 500);
  }
};

/**
 * GET /api/dashboard/leaderboard
 * Public leaderboard
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const { category = 'impact', limit = 50 } = req.query;

    let orderField;
    switch (category) {
      case 'active': orderField = 'active_projects_count'; break;
      case 'recycled': orderField = 'recycled_count'; break;
      case 'silver': orderField = 'total_silver_grams'; break;
      default: orderField = 'impact_score';
    }

    const { data: leaderboard } = await supabase
      .from('leaderboard_cache')
      .select('*')
      .order(orderField, { ascending: false })
      .limit(parseInt(limit));

    // Add rank numbers
    const ranked = (leaderboard || []).map((entry, index) => ({
      ...entry,
      display_rank: index + 1,
      is_current_user: entry.entity_id === req.user?.id,
    }));

    // Find current user's position
    const currentUserEntry = ranked.find(e => e.entity_id === req.user?.id);

    return sendSuccess(res, {
      leaderboard: ranked,
      current_user_position: currentUserEntry?.display_rank || null,
      category,
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch leaderboard', 500);
  }
};
