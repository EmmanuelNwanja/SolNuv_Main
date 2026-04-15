/**
 * SolNuv Dashboard Controller
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { calculatePortfolioSilver, calculatePortfolioRecycleIncome } = require('../services/silverService');
const logger = require('../utils/logger');

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}

function normalizeFeedbackValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeFeedbackText(value) {
  return normalizeFeedbackValue(value).replace(/\s+/g, ' ');
}

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
        const daysUntil = Math.ceil((+decommDate - +today) / (1000 * 60 * 60 * 24));
        return { ...p, days_until_decommission: daysUntil };
      })
      .filter(p => p.days_until_decommission <= 365)
      .sort((a, b) => a.days_until_decommission - b.days_until_decommission)
      .slice(0, 5); // Top 5 closest

    // Silver portfolio + recycle income (run in parallel)
    const [silverPortfolio, recycleIncome] = await Promise.all([
      calculatePortfolioSilver(userId, companyId),
      calculatePortfolioRecycleIncome(userId, companyId),
    ]);

    // User's leaderboard rank — company users are ranked as a company entity
    const leaderboardEntityId = companyId || userId;
    const { data: leaderboard } = await supabase
      .from('leaderboard_cache')
      .select('rank_active, rank_recycled, rank_impact, impact_score')
      .eq('entity_id', leaderboardEntityId)
      .single();

    // Recent activity (last 5 projects)
    const recent = allProjects
      .sort((a, b) => +new Date(b.installation_date) - +new Date(a.installation_date))
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
      recycle_income: recycleIncome,
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

    const recycleIncome = await calculatePortfolioRecycleIncome(userId, companyId);

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
      recycle_income: recycleIncome,
    });
  } catch (error) {
    logger.error('Failed to calculate impact', { user_id: req.user?.id || null, company_id: req.user?.company_id || null, message: error.message });
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
      .select('id, user_id, company_id, status, geo_verified');

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

      // Verification trust score: verified = 3pts, unverified = 1pt
      const verifiedCount = userProjects.filter(p => p.geo_verified === true).length;
      const unverifiedCount = userProjects.length - verifiedCount;
      const verificationTrustScore = (verifiedCount * 3) + (unverifiedCount * 1);

      const impactScore =
        (recycled.length * 3) +
        (decommission.length * 2) +
        (active.length * 1) +
        (totalSilver * 0.1) +
        (co2AvoidedKg * 0.01) +
        (averageRating * 8) +
        verificationTrustScore;
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
        verified_projects_count:   verifiedCount,
        unverified_projects_count: unverifiedCount,
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
    logger.error('Failed to refresh leaderboard', { user_id: req.user?.id || null, message: error.message });
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
      verified_projects_count: entry.verified_projects_count || 0,
      unverified_projects_count: entry.unverified_projects_count || 0,
      display_rank: index + 1,
      is_current_user: entry.entity_id === req.user?.id,
    }));

    return sendSuccess(res, {
      leaderboard: ranked,
      current_user_position: ranked.find(e => e.entity_id === req.user?.id)?.display_rank || null,
      category,
    });
  } catch (error) {
    logger.error('Failed to fetch leaderboard', { user_id: req.user?.id || null, message: error.message });
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
    logger.error('Failed to load feedback overview', { user_id: req.user?.id || null, company_id: req.user?.company_id || null, message: error.message });
    return sendError(res, 'Failed to load feedback overview', 500);
  }
};

/**
 * POST /api/dashboard/feedback/link/:projectId
 */
exports.generateFeedbackLink = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const companyId = req.user.company_id;

    // Build ownership query - match by company_id OR by user_id (for orphaned projects)
    let projectQuery = supabase
      .from('projects')
      .select('id, name, feedback_token')
      .eq('id', projectId);

    if (companyId) {
      projectQuery = projectQuery.or(`company_id.eq.${companyId},and(user_id.eq.${userId},company_id.is.null)`);
    } else {
      projectQuery = projectQuery.eq('user_id', userId);
    }

    const { data: project } = await projectQuery.single();

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
    logger.error('Failed to generate feedback link', { user_id: req.user?.id || null, project_id: req.params?.projectId || null, message: error.message });
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
      submission_key,
    } = req.body || {};

    const normalizedSubmissionKey = String(submission_key || '').trim() || null;
    const normalizedName = normalizeFeedbackValue(client_name);
    const normalizedEmail = normalizeFeedbackValue(client_email);
    const normalizedPhone = normalizeFeedbackValue(client_phone);
    const normalizedComment = normalizeFeedbackText(comment);
    const numericRating = Number(rating);

    if (!rating || numericRating < 1 || numericRating > 5) {
      return sendError(res, 'Rating must be between 1 and 5', 400);
    }

    if (!String(client_name || '').trim()) {
      return sendError(res, 'Client name is required', 400);
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, user_id, company_id')
      .eq('feedback_token', token)
      .single();

    if (!project) return sendError(res, 'Invalid feedback link', 404);

    if (normalizedSubmissionKey) {
      const { data: existingByKey, error: existingByKeyError } = await supabase
        .from('project_feedback')
        .select('*')
        .eq('project_id', project.id)
        .eq('submission_key', normalizedSubmissionKey)
        .limit(1);

      if (existingByKeyError) throw existingByKeyError;
      if (existingByKey?.length) {
        return sendSuccess(res, existingByKey[0], 'Feedback already submitted');
      }
    }

    const { data: recentFeedback, error: recentFeedbackError } = await supabase
      .from('project_feedback')
      .select('*')
      .eq('project_id', project.id)
      .order('submitted_at', { ascending: false })
      .limit(20);

    if (recentFeedbackError) throw recentFeedbackError;

    const duplicateWindowMs = 15 * 60 * 1000;
    const duplicateFeedback = (recentFeedback || []).find((item) => {
      const submittedAt = item.submitted_at ? new Date(item.submitted_at).getTime() : 0;
      const isRecent = submittedAt > 0 && (Date.now() - submittedAt) <= duplicateWindowMs;
      if (!isRecent) return false;

      const sameIdentity = (
        (normalizedEmail && normalizeFeedbackValue(item.client_email) === normalizedEmail) ||
        (normalizedPhone && normalizeFeedbackValue(item.client_phone) === normalizedPhone) ||
        (normalizedName && normalizeFeedbackValue(item.client_name) === normalizedName)
      );

      const sameContent = Number(item.rating || 0) === numericRating
        && normalizeFeedbackText(item.comment) === normalizedComment;

      return sameIdentity && sameContent;
    });

    if (duplicateFeedback) {
      return sendSuccess(res, duplicateFeedback, 'Feedback already submitted');
    }

    const { data, error } = await supabase
      .from('project_feedback')
      .insert({
        project_id: project.id,
        user_id: project.user_id,
        company_id: project.company_id,
        client_name,
        client_email,
        client_phone,
        rating: numericRating,
        comment,
        consent_to_showcase: consent_to_showcase !== false,
        submission_key: normalizedSubmissionKey,
      })
      .select('*')
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Feedback submitted successfully', 201);
  } catch (error) {
    logger.error('Failed to submit public feedback', { token: req.params?.token || null, message: error.message });
    return sendError(res, 'Failed to submit feedback', 500);
  }
};

/**
 * GET /api/dashboard/public/profile/:slug
 */
exports.getPublicProfile = async (req, res) => {
  try {
    const normalizedSlug = normalizeSlug(decodeURIComponent(req.params.slug || ''));
    if (!normalizedSlug) return sendError(res, 'Profile not found', 404);

    const userSelect = 'id, first_name, last_name, brand_name, public_slug, public_bio, is_public_profile, company_id, email, phone';

    let user = null;

    // 1) Primary path: explicit public_slug
    const { data: directMatches, error: directError } = await supabase
      .from('users')
      .select(userSelect)
      .eq('is_public_profile', true)
      .ilike('public_slug', normalizedSlug)
      .limit(5);

    if (directError) throw directError;
    user = (directMatches || []).find((u) => normalizeSlug(u.public_slug) === normalizedSlug) || (directMatches || [])[0] || null;

    // 2) Fallback path: brand_name slug match
    if (!user) {
      const brandNeedle = normalizedSlug.replace(/-/g, ' ');
      const { data: brandMatches, error: brandError } = await supabase
        .from('users')
        .select(userSelect)
        .eq('is_public_profile', true)
        .ilike('brand_name', `%${brandNeedle}%`)
        .limit(30);

      if (brandError) throw brandError;
      user = (brandMatches || []).find((u) => normalizeSlug(u.brand_name) === normalizedSlug) || null;
    }

    // 3) Fallback path: company name slug match
    if (!user) {
      const companyNeedle = normalizedSlug.replace(/-/g, ' ');
      const { data: companyMatches, error: companyError } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${companyNeedle}%`)
        .limit(20);

      if (companyError) throw companyError;

      const companyIds = (companyMatches || []).map((c) => c.id);
      if (companyIds.length > 0) {
        const companyMap = new Map((companyMatches || []).map((c) => [c.id, c]));
        const { data: usersByCompany, error: usersByCompanyError } = await supabase
          .from('users')
          .select(userSelect)
          .eq('is_public_profile', true)
          .in('company_id', companyIds)
          .limit(60);

        if (usersByCompanyError) throw usersByCompanyError;
        user = (usersByCompany || []).find((u) => normalizeSlug((companyMap.get(u.company_id) as { name?: string } | undefined)?.name) === normalizedSlug) || null;
      }
    }

    if (!user) return sendError(res, 'Profile not found', 404);

    let companyMeta = null;
    if (user.company_id) {
      const { data: companyData } = await supabase
        .from('companies')
        .select('name, logo_url, website, email, phone, address, city, state, nesrea_registration_number, branding_primary_color')
        .eq('id', user.company_id)
        .maybeSingle();
      companyMeta = companyData || null;
    }

    // Build ownership query - match by company_id OR by user_id (for orphaned projects)
    let projectsQuery = supabase
      .from('projects')
      .select('id, name, status, state, city, address, latitude, longitude, installation_date, estimated_decommission_date, total_system_size_kw, created_at')
      .order('created_at', { ascending: false })
      .limit(30);

    if (user.company_id) {
      projectsQuery = projectsQuery.or(`company_id.eq.${user.company_id},and(user_id.eq.${user.id},company_id.is.null)`);
    } else {
      projectsQuery = projectsQuery.eq('user_id', user.id);
    }

    const { data: projects } = await projectsQuery;

    const projectIds = (projects || []).map((p) => p.id);

    let equipment = [];
    if (projectIds.length > 0) {
      const { data: equipmentRows } = await supabase
        .from('equipment')
        .select('project_id, equipment_type, brand, model, size_watts, capacity_kwh, power_kw, quantity')
        .in('project_id', projectIds);
      equipment = equipmentRows || [];
    }

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

    const panelEquipment = equipment.filter((item) => item.equipment_type === 'panel');
    const batteryEquipment = equipment.filter((item) => item.equipment_type === 'battery');
    const inverterEquipment = equipment.filter((item) => item.equipment_type === 'inverter');

    const totalPanelCount = panelEquipment.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalBatteryCount = batteryEquipment.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalInverterCount = inverterEquipment.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const panelCapacityKw = panelEquipment.reduce(
      (sum, item) => sum + ((Number(item.size_watts || 0) * Number(item.quantity || 0)) / 1000),
      0
    );
    const inverterCapacityKw = inverterEquipment.reduce(
      (sum, item) => sum + (Number(item.power_kw || 0) * Number(item.quantity || 0)),
      0
    );
    const batteryCapacityKwh = batteryEquipment.reduce(
      (sum, item) => sum + (Number(item.capacity_kwh || 0) * Number(item.quantity || 0)),
      0
    );

    const projectsTotalKw = (projects || []).reduce((sum, item) => sum + Number(item.total_system_size_kw || 0), 0);
    const cumulativeCapacityKw = projectsTotalKw || panelCapacityKw || inverterCapacityKw;

    const manufacturersByType = {
      panel: [...new Set(panelEquipment.map((item) => item.brand).filter(Boolean))],
      battery: [...new Set(batteryEquipment.map((item) => item.brand).filter(Boolean))],
      inverter: [...new Set(inverterEquipment.map((item) => item.brand).filter(Boolean))],
    };

    const equipmentByProject = equipment.reduce((acc, item) => {
      const list = acc.get(item.project_id) || [];
      list.push(item);
      acc.set(item.project_id, list);
      return acc;
    }, new Map());

    const points = (projects || [])
      .filter((item) => item.latitude !== null && item.longitude !== null)
      .map((item) => {
        const projEquip = equipmentByProject.get(item.id) || [];
        const pCount = projEquip.filter((eq) => eq.equipment_type === 'panel').reduce((s, eq) => s + Number(eq.quantity || 0), 0);
        const bCount = projEquip.filter((eq) => eq.equipment_type === 'battery').reduce((s, eq) => s + Number(eq.quantity || 0), 0);
        const iCount = projEquip.filter((eq) => eq.equipment_type === 'inverter').reduce((s, eq) => s + Number(eq.quantity || 0), 0);
        const capKw = Number(item.total_system_size_kw || 0)
          || projEquip.filter((eq) => eq.equipment_type === 'panel').reduce((s, eq) => s + ((Number(eq.size_watts || 0) * Number(eq.quantity || 0)) / 1000), 0);
        return {
          id: item.id,
          name: item.name,
          city: item.city,
          state: item.state,
          status: item.status,
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          capacity_kw: Number(capKw.toFixed(2)),
          installation_date: item.installation_date || null,
          panel_count: pCount,
          battery_count: bCount,
          inverter_count: iCount,
        };
      });

    const regionalCoverage = [...new Set((projects || []).map((item) => item.state).filter(Boolean))].length;

    const enrichedProjects = (projects || []).map((item) => {
      const projectEquipment = equipmentByProject.get(item.id) || [];
      const projectPanelCount = projectEquipment
        .filter((eq) => eq.equipment_type === 'panel')
        .reduce((sum, eq) => sum + Number(eq.quantity || 0), 0);
      const projectBatteryCount = projectEquipment
        .filter((eq) => eq.equipment_type === 'battery')
        .reduce((sum, eq) => sum + Number(eq.quantity || 0), 0);
      const projectInverterCount = projectEquipment
        .filter((eq) => eq.equipment_type === 'inverter')
        .reduce((sum, eq) => sum + Number(eq.quantity || 0), 0);

      const projectCapacityKw = Number(item.total_system_size_kw || 0)
        || projectEquipment
          .filter((eq) => eq.equipment_type === 'panel')
          .reduce((sum, eq) => sum + ((Number(eq.size_watts || 0) * Number(eq.quantity || 0)) / 1000), 0)
        || projectEquipment
          .filter((eq) => eq.equipment_type === 'inverter')
          .reduce((sum, eq) => sum + (Number(eq.power_kw || 0) * Number(eq.quantity || 0)), 0);

      return {
        id: item.id,
        name: item.name,
        status: item.status,
        state: item.state,
        city: item.city,
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        installation_date: item.installation_date,
        estimated_decommission_date: item.estimated_decommission_date,
        logging_date: item.created_at,
        project_capacity_mw: Number((projectCapacityKw / 1000).toFixed(4)),
        equipment_summary: {
          panel_count: projectPanelCount,
          battery_count: projectBatteryCount,
          inverter_count: projectInverterCount,
          manufacturers: {
            panel: [...new Set(projectEquipment.filter((eq) => eq.equipment_type === 'panel').map((eq) => eq.brand).filter(Boolean))],
            battery: [...new Set(projectEquipment.filter((eq) => eq.equipment_type === 'battery').map((eq) => eq.brand).filter(Boolean))],
            inverter: [...new Set(projectEquipment.filter((eq) => eq.equipment_type === 'inverter').map((eq) => eq.brand).filter(Boolean))],
          },
        },
      };
    });

    const primaryName = companyMeta?.name || user.brand_name || `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const contactPhone = companyMeta?.phone || user.phone || null;
    const contactEmail = companyMeta?.email || user.email || null;
    const contactAddress = companyMeta?.address || [companyMeta?.city, companyMeta?.state].filter(Boolean).join(', ') || null;

    // Environmental impact estimates
    // Avg African solar yield ~1500 kWh/kWp/yr; grid emission factor ~0.5 kg CO2/kWh (sub-Saharan Africa avg)
    const annualGenerationMwh = (cumulativeCapacityKw * 1.5) / 1000; // MWh/yr
    const lifetimeYears = 25;
    const co2OffsetTonnesPerYear = annualGenerationMwh * 0.5; // tonnes CO2/yr
    const co2OffsetLifetimeTonnes = co2OffsetTonnesPerYear * lifetimeYears;
    const treesEquivalent = Math.round(co2OffsetLifetimeTonnes / 0.022); // ~22 kg CO2 absorbed per tree per year over lifetime
    const homesEquivalent = Math.round(annualGenerationMwh / 2.5); // avg African household ~2,500 kWh/yr

    return sendSuccess(res, {
      profile: {
        name: primaryName,
        public_slug: user.public_slug,
        bio: user.public_bio,
        logo_url: companyMeta?.logo_url || null,
        website: companyMeta?.website || null,
        primary_color: companyMeta?.branding_primary_color || '#0D3B2E',
        registration: companyMeta?.nesrea_registration_number || null,
        contact: {
          phone: contactPhone,
          email: contactEmail,
          address: contactAddress,
        },
      },
      stats: {
        total_projects: (projects || []).length,
        active_projects: activeCount,
        recycled_projects: recycledCount,
        average_rating: Number(averageRating.toFixed(2)),
        total_feedback: feedback.length,
        cumulative_executed_capacity_mw: Number((cumulativeCapacityKw / 1000).toFixed(4)),
        cumulative_storage_capacity_mwh: Number((batteryCapacityKwh / 1000).toFixed(4)),
        total_panels: totalPanelCount,
        total_batteries: totalBatteryCount,
        total_inverters: totalInverterCount,
        regional_coverage_states: regionalCoverage,
      },
      environmental_impact: {
        annual_generation_mwh: Number(annualGenerationMwh.toFixed(2)),
        co2_offset_tonnes_per_year: Number(co2OffsetTonnesPerYear.toFixed(2)),
        co2_offset_lifetime_tonnes: Number(co2OffsetLifetimeTonnes.toFixed(1)),
        trees_equivalent: treesEquivalent,
        homes_powered: homesEquivalent,
      },
      map_summary: {
        points,
        total_mapped_projects: points.length,
      },
      equipment_summary: {
        manufacturers: manufacturersByType,
        panel_capacity_kw: Number(panelCapacityKw.toFixed(2)),
        inverter_capacity_kw: Number(inverterCapacityKw.toFixed(2)),
        battery_capacity_kwh: Number(batteryCapacityKwh.toFixed(2)),
      },
      recent_projects: enrichedProjects.slice(0, 12),
      projects: enrichedProjects,
      reviews: feedback,
    });
  } catch (error) {
    logger.error('Failed to load public profile', { slug: req.params?.slug || null, message: error.message });
    return sendError(res, 'Failed to load public profile', 500);
  }
};