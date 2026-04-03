// backend/src/controllers/analyticsController.js
const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');

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
    ]);

    // ── Blog per-post reads aggregation ──────────────────────
    const readsByPost = {};
    for (const r of (postReadDetails.data || [])) {
      readsByPost[r.post_id] = (readsByPost[r.post_id] || 0) + 1;
    }
    const clicksByPost = {};
    for (const c of (postClickDetails.data || [])) {
      clicksByPost[c.post_id] = (clicksByPost[c.post_id] || 0) + 1;
    }

    // ── Page view per-path aggregation ────────────────────────
    const viewsByPath = {};
    for (const pv of (pageViewsPerPath.data || [])) {
      viewsByPath[pv.path] = (viewsByPath[pv.path] || 0) + 1;
    }
    const topPages = Object.entries(viewsByPath)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([path, views]) => ({ path, views }));

    const durations = (avgPageDuration.data || []).map((r) => r.duration_s).filter(Boolean);
    const avgDuration = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null;

    // ── Finance aggregation ────────────────────────────────────
    const txData = allTransactions.data || [];
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
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([company_id, amount_ngn]) => ({ company_id, amount_ngn }));

    // ── Calculator usage by type ───────────────────────────────
    const calcByType = {};
    for (const c of (calcUsageStats.data || [])) {
      calcByType[c.calc_type] = (calcByType[c.calc_type] || 0) + Number(c.use_count || 0);
    }

    return sendSuccess(res, {
      range: { from: start, to: end },

      blog: {
        total_published_posts: totalPublishedPosts.count || 0,
        total_reads: totalReads.count || 0,
        total_link_clicks: totalLinkClicks.count || 0,
        reads_by_post: readsByPost,
        clicks_by_post: clicksByPost,
      },

      pages: {
        total_views: pageViewsTotal.count || 0,
        top_pages: topPages,
        avg_session_duration_s: avgDuration,
      },

      finance: {
        total_revenue_ngn: totalRevenue,
        total_transactions: txData.length,
        paystack_transactions: paystackTx.count || 0,
        direct_transactions: directTx.count || 0,
        revenue_by_plan: revenueByPlan,
        top_company_revenue: topCompanyRevenue,
      },

      users: {
        total_users: totalUsers.count || 0,
        active_last_30d: activeUsersLast30.count || 0,
        new_last_30d: newUsersLast30.count || 0,
        calculator_usage_by_type: calcByType,
      },

      ads: {
        total_impressions: totalAdImpressions.count || 0,
        total_clicks: totalAdClicks.count || 0,
        overall_ctr: totalAdImpressions.count
          ? ((totalAdClicks.count / totalAdImpressions.count) * 100).toFixed(2)
          : '0.00',
        active_ads: (adBreakdown.data || []).length,
      },

      contact: {
        total_submissions: totalContacts.count || 0,
        new_in_range: newContacts.count || 0,
      },

      projects: {
        total_projects: totalProjects.count || 0,
        new_in_range: projectsLast30.count || 0,
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
