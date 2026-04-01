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

    // User's leaderboard rank — company users are ranked as a company entity
    const leaderboardEntityId = companyId || userId;
    const { data: leaderboard } = await supabase
      .from('leaderboard_cache')
      .select('rank_active, rank_recycled, rank_impact, impact_score')
      .eq('entity_id', leaderboardEntityId)
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
 * GET /api/dashboard/refresh-leaderboard
 * Manually trigger a leaderboard rebuild
 */
exports.refreshLeaderboard = async (req, res) => {
  try {
    // Inline the refresh here to avoid circular dependency
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, brand_name, company_id, companies(name)');

    const { data: projects } = await supabase
      .from('projects')
      .select('id, user_id, company_id, status');

    const { data: equipment } = await supabase
      .from('equipment')
      .select('project_id, equipment_type, quantity, estimated_silver_grams');

    const { data: feedbackRows } = await supabase
      .from('project_feedback')
      .select('project_id, rating, consent_to_showcase')
      .order('submitted_at', { ascending: false });

    if (!users || !projects) {
      return sendError(res, 'Failed to fetch data for leaderboard refresh', 500);
    }

    // Build equipment map
    const eqByProject = {};
    for (const eq of equipment || []) {
      if (!eqByProject[eq.project_id]) eqByProject[eq.project_id] = [];
      eqByProject[eq.project_id].push(eq);
    }

    const feedbackByProject = {};
    for (const item of feedbackRows || []) {
      if (!feedbackByProject[item.project_id]) feedbackByProject[item.project_id] = [];
      feedbackByProject[item.project_id].push(item);
    }

    const entries = [];

    for (const user of users) {
      const userProjects = projects.filter(p =>
        p.user_id === user.id ||
        (user.company_id && p.company_id === user.company_id)
      );

      if (userProjects.length === 0) continue;

      const active       = userProjects.filter(p => p.status === 'active');
      const decommission = userProjects.filter(p => p.status === 'decommissioned');
      const recycled     = userProjects.filter(p => p.status === 'recycled');

      let totalPanels = 0, totalBatteries = 0, totalSilver = 0, expectedSilver = 0;
      let co2AvoidedKg = 0;
      let totalFeedbacks = 0;
      let ratingSum = 0;

      for (const proj of userProjects) {
        for (const eq of eqByProject[proj.id] || []) {
          if (eq.equipment_type === 'panel') {
            totalPanels += eq.quantity;
            totalSilver += eq.estimated_silver_grams || 0;
          } else {
            totalBatteries += eq.quantity;
          }
        }
      }
      for (const proj of active) {
        for (const eq of eqByProject[proj.id] || []) {
          if (eq.equipment_type === 'panel') expectedSilver += eq.estimated_silver_grams || 0;
        }
      }

      for (const proj of recycled) {
        for (const eq of eqByProject[proj.id] || []) {
          if (eq.equipment_type === 'panel') co2AvoidedKg += (eq.quantity || 0) * 230;
        }
      }

      for (const proj of userProjects) {
        const feedbackItems = feedbackByProject[proj.id] || [];
        for (const fb of feedbackItems) {
          totalFeedbacks += 1;
          ratingSum += Number(fb.rating || 0);
        }
      }

      const averageRating = totalFeedbacks > 0 ? (ratingSum / totalFeedbacks) : 0;

      const impactScore =
        (recycled.length * 3) +
        (decommission.length * 2) +
        (active.length * 1) +
        (totalSilver * 0.1) +
        (co2AvoidedKg * 0.01) +
        (averageRating * 8);
      const entityName  = user.companies?.name || user.brand_name || `${user.first_name} ${user.last_name || ''}`.trim();

      entries.push({
        entity_id:             user.id,
        entity_name:           entityName,
        entity_type:           'user',
        active_projects_count: active.length,
        decommissioned_count:  decommission.length,
        recycled_count:        recycled.length,
        total_panels:          totalPanels,
        total_batteries:       totalBatteries,
        total_silver_grams:    parseFloat(totalSilver.toFixed(4)),
        expected_silver_grams: parseFloat(expectedSilver.toFixed(4)),
        co2_avoided_kg:        parseFloat(co2AvoidedKg.toFixed(2)),
        average_rating:        parseFloat(averageRating.toFixed(2)),
        total_feedbacks:       totalFeedbacks,
        impact_score:          parseFloat(impactScore.toFixed(2)),
        updated_at:            new Date().toISOString(),
      });
    }

    // Assign ranks
    const byActive   = [...entries].sort((a, b) => b.active_projects_count - a.active_projects_count);
    const byRecycled = [...entries].sort((a, b) => b.recycled_count - a.recycled_count);
    const byImpact   = [...entries].sort((a, b) => b.impact_score - a.impact_score);

    for (const e of entries) {
      e.rank_active   = byActive.findIndex(x => x.entity_id === e.entity_id) + 1;
      e.rank_recycled = byRecycled.findIndex(x => x.entity_id === e.entity_id) + 1;
      e.rank_impact   = byImpact.findIndex(x => x.entity_id === e.entity_id) + 1;
    }

    // Clear and reinsert
    await supabase.from('leaderboard_cache').delete().gt('updated_at', '2000-01-01');

    if (entries.length > 0) {
      await supabase.from('leaderboard_cache').insert(entries);
    }

    return sendSuccess(res, { message: 'Leaderboard refreshed successfully' });
  } catch (error) {
    return sendError(res, 'Failed to refresh leaderboard', 500);
  }
};

/**
 * GET /api/dashboard/leaderboard
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const {
      category = 'impact',
      limit = 50,
      min_projects,
      min_rating,
      sort_by,
    } = req.query;
    let orderField;
    switch (category) {
      case 'active':   orderField = 'active_projects_count'; break;
      case 'recycled': orderField = 'recycled_count'; break;
      case 'silver':   orderField = 'total_silver_grams'; break;
      case 'co2':      orderField = 'co2_avoided_kg'; break;
      case 'rating':   orderField = 'average_rating'; break;
      default:         orderField = 'impact_score';
    }

    if (sort_by === 'projects') orderField = 'active_projects_count';
    if (sort_by === 'rating') orderField = 'average_rating';
    if (sort_by === 'co2') orderField = 'co2_avoided_kg';

    let query = supabase
      .from('leaderboard_cache')
      .select('*')
      .order(orderField, { ascending: false })
      .limit(parseInt(limit));

    if (min_projects !== undefined && String(min_projects).trim() !== '') {
      query = query.gte('active_projects_count', Number(min_projects));
    }
    if (min_rating !== undefined && String(min_rating).trim() !== '') {
      query = query.gte('average_rating', Number(min_rating));
    }

    const { data: leaderboard } = await query;

    const ranked = (leaderboard || []).map((entry, index) => ({
      ...entry,
      display_rank: index + 1,
      is_current_user: entry.entity_id === req.user?.id,
    }));

    return sendSuccess(res, {
      leaderboard: ranked,
      current_user_position: ranked.find(e => e.entity_id === req.user?.id)?.display_rank || null,
      category,
    });
  } catch (error) {
    return sendError(res, 'Failed to fetch leaderboard', 500);
  }
};

/**
 * GET /api/dashboard/feedback
 */
exports.getFeedbackOverview = async (req, res) => {
  try {
    const scopeFilter = req.user.company_id
      ? { field: 'company_id', value: req.user.company_id }
      : { field: 'user_id', value: req.user.id };

    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, client_name, feedback_token, status, created_at')
      .eq(scopeFilter.field, scopeFilter.value)
      .order('created_at', { ascending: false });

    const projectIds = (projects || []).map((p) => p.id);
    let feedback = [];
    if (projectIds.length > 0) {
      const { data } = await supabase
        .from('project_feedback')
        .select('*')
        .in('project_id', projectIds)
        .order('submitted_at', { ascending: false });
      feedback = data || [];
    }

    const ratingTotal = feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    const averageRating = feedback.length > 0 ? ratingTotal / feedback.length : 0;

    return sendSuccess(res, {
      projects: projects || [],
      feedback: feedback || [],
      summary: {
        total_feedback: feedback.length,
        average_rating: Number(averageRating.toFixed(2)),
        showcase_reviews: (feedback || []).filter((f) => f.consent_to_showcase !== false).length,
      },
    });
  } catch (error) {
    return sendError(res, 'Failed to load feedback overview', 500);
  }
};

/**
 * POST /api/dashboard/feedback/link/:projectId
 */
exports.generateFeedbackLink = async (req, res) => {
  try {
    const { projectId } = req.params;
    const scopeField = req.user.company_id ? 'company_id' : 'user_id';
    const scopeValue = req.user.company_id || req.user.id;

    const { data: project } = await supabase
      .from('projects')
      .select('id, name, feedback_token')
      .eq('id', projectId)
      .eq(scopeField, scopeValue)
      .single();

    if (!project) return sendError(res, 'Project not found', 404);

    let token = project.feedback_token;
    if (!token) {
      token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      await supabase.from('projects').update({ feedback_token: token }).eq('id', projectId);
    }

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    const feedbackUrl = `${frontendBase}/feedback/${token}`;

    return sendSuccess(res, {
      project_id: project.id,
      project_name: project.name,
      feedback_token: token,
      feedback_url: feedbackUrl,
    }, 'Feedback link generated');
  } catch (error) {
    return sendError(res, 'Failed to generate feedback link', 500);
  }
};

/**
 * POST /api/dashboard/public/feedback/:token
 */
exports.submitPublicFeedback = async (req, res) => {
  try {
    const { token } = req.params;
    const {
      client_name,
      client_email,
      client_phone,
      rating,
      comment,
      consent_to_showcase = true,
    } = req.body || {};

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return sendError(res, 'Rating must be between 1 and 5', 400);
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, user_id, company_id')
      .eq('feedback_token', token)
      .single();

    if (!project) return sendError(res, 'Invalid feedback link', 404);

    const { data, error } = await supabase
      .from('project_feedback')
      .insert({
        project_id: project.id,
        user_id: project.user_id,
        company_id: project.company_id,
        client_name,
        client_email,
        client_phone,
        rating: Number(rating),
        comment,
        consent_to_showcase: consent_to_showcase !== false,
      })
      .select('*')
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Feedback submitted successfully', 201);
  } catch (error) {
    return sendError(res, 'Failed to submit feedback', 500);
  }
};

/**
 * GET /api/dashboard/public/profile/:slug
 */
exports.getPublicProfile = async (req, res) => {
  try {
    const { slug } = req.params;

    const { data: user } = await supabase
      .from('users')
      .select('id, first_name, last_name, brand_name, public_slug, public_bio, is_public_profile, company_id, companies(name, logo_url, website)')
      .eq('public_slug', slug)
      .single();

    if (!user || user.is_public_profile === false) {
      return sendError(res, 'Profile not found', 404);
    }

    const scopeField = user.company_id ? 'company_id' : 'user_id';
    const scopeValue = user.company_id || user.id;

    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, status, state, city, created_at')
      .eq(scopeField, scopeValue)
      .order('created_at', { ascending: false })
      .limit(30);

    const projectIds = (projects || []).map((p) => p.id);

    let feedback = [];
    if (projectIds.length > 0) {
      const { data } = await supabase
        .from('project_feedback')
        .select('rating, comment, client_name, submitted_at, consent_to_showcase')
        .in('project_id', projectIds)
        .eq('consent_to_showcase', true)
        .order('submitted_at', { ascending: false })
        .limit(20);
      feedback = data || [];
    }

    const averageRating = feedback.length > 0
      ? feedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / feedback.length
      : 0;

    const activeCount = (projects || []).filter((p) => p.status === 'active').length;
    const recycledCount = (projects || []).filter((p) => p.status === 'recycled').length;

    return sendSuccess(res, {
      profile: {
        name: user.companies?.name || user.brand_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        public_slug: user.public_slug,
        bio: user.public_bio,
        logo_url: user.companies?.logo_url || null,
        website: user.companies?.website || null,
      },
      stats: {
        total_projects: (projects || []).length,
        active_projects: activeCount,
        recycled_projects: recycledCount,
        average_rating: Number(averageRating.toFixed(2)),
        total_feedback: feedback.length,
      },
      recent_projects: projects || [],
      reviews: feedback,
    });
  } catch (error) {
    return sendError(res, 'Failed to load public profile', 500);
  }
};