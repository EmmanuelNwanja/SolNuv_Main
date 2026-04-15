// backend/src/controllers/analyticsController.js
const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');

function withOptional(result, label) {
  if (result?.error) {
    logger.warn('Analytics optional query failed', {
      label,
      message: result.error.message,
      code: result.error.code,
      details: result.error.details,
      hint: result.error.hint,
    });
    return { ...result, data: [], count: 0, error: null };
  }
  return result;
}

exports.getFullAnalytics = async (req, res) => {
  try {
    const { from: fromDate, to: toDate } = req.query;
    const start = fromDate ? new Date(fromDate).toISOString() : new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const end = toDate ? new Date(toDate).toISOString() : new Date().toISOString();

    const [
      // Blog
      totalReads,
      totalLinkClicks,
      postReadDetails,
      postClickDetails,
      totalPublishedPosts,

      // Page views
      pageViewsTotal,
      pageViewsPerPath,
      avgPageDuration,

      // Finance
      allTransactions,
      paystackTx,
      directTx,

      // Users
      totalUsers,
      activeUsersLast30,
      newUsersLast30,
      calcUsageStats,

      // Ads
      totalAdImpressions,
      totalAdClicks,
      adBreakdown,

      // Contacts
      totalContacts,
      newContacts,

      // Projects
      totalProjects,
      projectsLast30,

      // Design & Modelling
      totalDesigns,
      designsInRange,
      totalSimulations,
      simulationsInRange,
      totalReportShares,
      totalLoadProfiles,

    ] = await Promise.all([
      supabase.from('blog_post_reads').select('*', { count: 'exact', head: true }).gte('read_at', start).lte('read_at', end),
      supabase.from('blog_link_clicks').select('*', { count: 'exact', head: true }).gte('clicked_at', start).lte('clicked_at', end),
      supabase.from('blog_post_reads')
        .select('post_id')
        .gte('read_at', start).lte('read_at', end),
      supabase.from('blog_link_clicks')
        .select('post_id')
        .gte('clicked_at', start).lte('clicked_at', end),
      supabase.from('blog_posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),

      supabase.from('page_views').select('*', { count: 'exact', head: true }).gte('viewed_at', start).lte('viewed_at', end),
      supabase.from('page_views').select('path').gte('viewed_at', start).lte('viewed_at', end).limit(5000),
      supabase.from('page_views').select('duration_s').gte('viewed_at', start).lte('viewed_at', end).not('duration_s', 'is', null).limit(5000),

      supabase.from('subscription_transactions').select('amount_ngn,paid_at,plan,paystack_reference,company_id').gte('paid_at', start).lte('paid_at', end).limit(5000),
      supabase.from('subscription_transactions').select('*', { count: 'exact', head: true }).not('paystack_reference', 'is', null).gte('paid_at', start).lte('paid_at', end),
      supabase.from('subscription_transactions').select('*', { count: 'exact', head: true }).is('paystack_reference', null).gte('paid_at', start).lte('paid_at', end),

      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_login_at', start),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('calculator_usage').select('calc_type,use_count').gte('last_used_at', start).lte('last_used_at', end).limit(2000),

      supabase.from('ad_impressions').select('*', { count: 'exact', head: true }).gte('shown_at', start).lte('shown_at', end),
      supabase.from('ad_clicks').select('*', { count: 'exact', head: true }).gte('clicked_at', start).lte('clicked_at', end),
      supabase.from('ads').select('id,title,placement').eq('is_active', true),

      supabase.from('contact_submissions').select('*', { count: 'exact', head: true }),
      supabase.from('contact_submissions').select('*', { count: 'exact', head: true }).gte('submitted_at', start),

      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', start),

      // Design & Modelling
      supabase.from('project_designs').select('*', { count: 'exact', head: true }),
      supabase.from('project_designs').select('*', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('simulation_results').select('*', { count: 'exact', head: true }),
      supabase.from('simulation_results').select('*', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('report_shares').select('*', { count: 'exact', head: true }),
      supabase.from('load_profiles').select('*', { count: 'exact', head: true }),
    ]);

    const safeTotalReads = withOptional(totalReads, 'blog_post_reads.total');
    const safeTotalLinkClicks = withOptional(totalLinkClicks, 'blog_link_clicks.total');
    const safePostReadDetails = withOptional(postReadDetails, 'blog_post_reads.details');
    const safePostClickDetails = withOptional(postClickDetails, 'blog_link_clicks.details');
    const safeTotalPublishedPosts = withOptional(totalPublishedPosts, 'blog_posts.total_published');
    const safePageViewsTotal = withOptional(pageViewsTotal, 'page_views.total');
    const safePageViewsPerPath = withOptional(pageViewsPerPath, 'page_views.by_path');
    const safeAvgPageDuration = withOptional(avgPageDuration, 'page_views.duration');
    const safeAllTransactions = withOptional(allTransactions, 'subscription_transactions.all');
    const safePaystackTx = withOptional(paystackTx, 'subscription_transactions.paystack');
    const safeDirectTx = withOptional(directTx, 'subscription_transactions.direct');
    const safeTotalUsers = withOptional(totalUsers, 'users.total');
    const safeActiveUsersLast30 = withOptional(activeUsersLast30, 'users.active_last30');
    const safeNewUsersLast30 = withOptional(newUsersLast30, 'users.new_last30');
    const safeCalcUsageStats = withOptional(calcUsageStats, 'calculator_usage');
    const safeTotalAdImpressions = withOptional(totalAdImpressions, 'ad_impressions');
    const safeTotalAdClicks = withOptional(totalAdClicks, 'ad_clicks');
    const safeAdBreakdown = withOptional(adBreakdown, 'ads.breakdown');
    const safeTotalContacts = withOptional(totalContacts, 'contact_submissions.total');
    const safeNewContacts = withOptional(newContacts, 'contact_submissions.new');
    const safeTotalProjects = withOptional(totalProjects, 'projects.total');
    const safeProjectsLast30 = withOptional(projectsLast30, 'projects.new');
    const safeTotalDesigns = withOptional(totalDesigns, 'project_designs.total');
    const safeDesignsInRange = withOptional(designsInRange, 'project_designs.range');
    const safeTotalSimulations = withOptional(totalSimulations, 'simulation_results.total');
    const safeSimulationsInRange = withOptional(simulationsInRange, 'simulation_results.range');
    const safeTotalReportShares = withOptional(totalReportShares, 'report_shares.total');
    const safeTotalLoadProfiles = withOptional(totalLoadProfiles, 'load_profiles.total');

    // ── Blog per-post reads aggregation ──────────────────────
    const readsByPost = {};
    for (const r of (safePostReadDetails.data || [])) {
      readsByPost[r.post_id] = (readsByPost[r.post_id] || 0) + 1;
    }
    const clicksByPost = {};
    for (const c of (safePostClickDetails.data || [])) {
      clicksByPost[c.post_id] = (clicksByPost[c.post_id] || 0) + 1;
    }

    // ── Page view per-path aggregation ────────────────────────
    const viewsByPath = {};
    for (const pv of (safePageViewsPerPath.data || [])) {
      viewsByPath[pv.path] = (viewsByPath[pv.path] || 0) + 1;
    }
    const topPages = Object.entries(viewsByPath)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 20)
      .map(([path, views]) => ({ path, views }));

    const durations = (safeAvgPageDuration.data || []).map((r) => r.duration_s).filter(Boolean);
    const avgDuration = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null;

    // ── Finance aggregation ────────────────────────────────────
    const txData = safeAllTransactions.data || [];
    const totalRevenue = txData.reduce((sum, t) => sum + Number(t.amount_ngn || 0), 0);

    const revenueByPlan = {};
    for (const t of txData) {
      const planName = t.plan || 'unknown';
      revenueByPlan[planName] = (revenueByPlan[planName] || 0) + Number(t.amount_ngn || 0);
    }

    const revenueByCompany = {};
    for (const t of txData) {
      if (t.company_id) {
        revenueByCompany[t.company_id] = (revenueByCompany[t.company_id] || 0) + Number(t.amount_ngn || 0);
      }
    }
    const topCompanyRevenue = Object.entries(revenueByCompany)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 10)
      .map(([company_id, amount_ngn]) => ({ company_id, amount_ngn }));

    // ── Calculator usage by type ───────────────────────────────
    const calcByType = {};
    for (const c of (safeCalcUsageStats.data || [])) {
      calcByType[c.calc_type] = (calcByType[c.calc_type] || 0) + Number(c.use_count || 0);
    }

    return sendSuccess(res, {
      range: { from: start, to: end },

      blog: {
        total_published_posts: safeTotalPublishedPosts.count || 0,
        total_reads: safeTotalReads.count || 0,
        total_link_clicks: safeTotalLinkClicks.count || 0,
        reads_by_post: readsByPost,
        clicks_by_post: clicksByPost,
      },

      pages: {
        total_views: safePageViewsTotal.count || 0,
        top_pages: topPages,
        avg_session_duration_s: avgDuration,
      },

      finance: {
        total_revenue_ngn: totalRevenue,
        total_transactions: txData.length,
        paystack_transactions: safePaystackTx.count || 0,
        direct_transactions: safeDirectTx.count || 0,
        revenue_by_plan: revenueByPlan,
        top_company_revenue: topCompanyRevenue,
      },

      users: {
        total_users: safeTotalUsers.count || 0,
        active_last_30d: safeActiveUsersLast30.count || 0,
        new_last_30d: safeNewUsersLast30.count || 0,
        calculator_usage_by_type: calcByType,
      },

      ads: {
        total_impressions: safeTotalAdImpressions.count || 0,
        total_clicks: safeTotalAdClicks.count || 0,
        overall_ctr: safeTotalAdImpressions.count
          ? ((safeTotalAdClicks.count / safeTotalAdImpressions.count) * 100).toFixed(2)
          : '0.00',
        active_ads: (safeAdBreakdown.data || []).length,
      },

      contact: {
        total_submissions: safeTotalContacts.count || 0,
        new_in_range: safeNewContacts.count || 0,
      },

      projects: {
        total_projects: safeTotalProjects.count || 0,
        new_in_range: safeProjectsLast30.count || 0,
      },

      design: {
        total_designs: safeTotalDesigns.count || 0,
        designs_in_range: safeDesignsInRange.count || 0,
        total_simulations: safeTotalSimulations.count || 0,
        simulations_in_range: safeSimulationsInRange.count || 0,
        total_report_shares: safeTotalReportShares.count || 0,
        total_load_profiles: safeTotalLoadProfiles.count || 0,
      },
    });
  } catch (error) {
    logger.error('getFullAnalytics failed', { message: error.message });
    return sendError(res, 'Failed to load analytics', 500);
  }
};

// Track page view (internal beacon endpoint — no auth required)
exports.trackPageView = async (req, res) => {
  try {
    const { path, session_id, duration_s } = req.body;
    if (!path) return sendError(res, 'path required', 422);

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const crypto = require('crypto');
    const ip_hash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;

    await supabase.from('page_views').insert({
      path,
      user_id: req.user?.id || null,
      session_id: session_id || null,
      ip_hash,
      referrer: req.headers.referer || null,
      user_agent: req.headers['user-agent'] || null,
      duration_s: duration_s ? Number(duration_s) : null,
    });

    return sendSuccess(res, null);
  } catch (error) {
    logger.error('trackPageView failed', { message: error.message });
    return sendError(res, 'Failed to record page view', 500);
  }
};
