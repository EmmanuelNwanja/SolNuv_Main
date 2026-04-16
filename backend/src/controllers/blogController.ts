// backend/src/controllers/blogController.js
const supabase = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const crypto = require('crypto');

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + process.env.IP_HASH_SALT || '').digest('hex').slice(0, 16);
}

function resolveTrackingUserId(req) {
  return req.supabaseUser?.id || req.user?.supabase_uid || null;
}

function parsePositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

function parseNonNegativeFloat(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function normalizeSortBy(value) {
  const allowed = new Set(['ctr', 'clicks', 'impressions', 'unique_click_users', 'recent']);
  return allowed.has(value) ? value : 'recent';
}

function normalizeSortOrder(value) {
  return String(value || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function normalizeUserType(value) {
  const normalized = String(value || '').toLowerCase().trim();
  return normalized || null;
}

function normalizeAnalyticsFilters(query) {
  return {
    placement: query.placement ? String(query.placement).trim() : '',
    sort_by: normalizeSortBy(String(query.sort_by || '').trim()),
    order: normalizeSortOrder(query.order),
    min_clicks: parsePositiveInt(query.min_clicks, 0),
    min_ctr: parseNonNegativeFloat(query.min_ctr, 0),
    user_type: normalizeUserType(query.user_type),
    limit: Math.min(parsePositiveInt(query.limit, 20), 100),
  };
}

async function fetchAllAdClicks(adId, maxRows = 20000) {
  const rows = [];
  const batchSize = 1000;
  let from = 0;

  while (rows.length < maxRows) {
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from('ad_clicks')
      .select('id,user_id,page_path,clicked_at')
      .eq('ad_id', adId)
      .order('clicked_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}

async function fetchUsersBySupabaseIds(ids) {
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('users')
    .select('supabase_uid,first_name,last_name,email,brand_name,user_type')
    .in('supabase_uid', ids);

  if (error) throw error;

  return new Map((data || []).map((user) => [user.supabase_uid, user]));
}

function summarizeRecentPages(clickRows, recentPagesLimit) {
  const counts = new Map();
  for (const row of clickRows) {
    if (!row.page_path) continue;
    counts.set(row.page_path, (counts.get(row.page_path) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([page_path, clicks]) => ({ page_path, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, recentPagesLimit);
}

async function buildAdAnalytics(ad, options: Record<string, any> = {}) {
  const recentUsersLimit = options.recentUsersLimit || 10;
  const recentPagesLimit = options.recentPagesLimit || 5;

  const adId = ad.id;
  const [impressionsResult, totalClicksResult, clickRows] = await Promise.all([
    supabase.from('ad_impressions').select('id', { count: 'exact', head: true }).eq('ad_id', adId),
    supabase.from('ad_clicks').select('id', { count: 'exact', head: true }).eq('ad_id', adId),
    fetchAllAdClicks(adId),
  ]);

  const impressions = impressionsResult.count || 0;
  const clicks = totalClicksResult.count || 0;

  const userIds = [...new Set(clickRows.map((row) => row.user_id).filter(Boolean))];
  const usersBySupabaseId = await fetchUsersBySupabaseIds(userIds);

  const clicksByUserType: Record<string, number> = {};
  let anonymousClicks = 0;
  const uniqueUsers = new Set();
  const recentClickUsers = [];
  const seenRecentUsers = new Set();

  for (const row of clickRows) {
    if (!row.user_id) {
      anonymousClicks += 1;
      clicksByUserType.guest = (clicksByUserType.guest || 0) + 1;
      continue;
    }

    uniqueUsers.add(row.user_id);
    const user = usersBySupabaseId.get(row.user_id) || null;
    const userType = user?.user_type || 'unknown';
    clicksByUserType[userType] = (clicksByUserType[userType] || 0) + 1;

    if (!seenRecentUsers.has(row.user_id) && recentClickUsers.length < recentUsersLimit) {
      seenRecentUsers.add(row.user_id);
      recentClickUsers.push({
        clicked_at: row.clicked_at,
        user: user ? {
          supabase_uid: user.supabase_uid,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          email: user.email || null,
          brand_name: user.brand_name || null,
          user_type: user.user_type || null,
        } : {
          supabase_uid: row.user_id,
          first_name: null,
          last_name: null,
          email: null,
          brand_name: null,
          user_type: 'unknown',
        },
      });
    }
  }

  const uniqueClickUsers = uniqueUsers.size;
  const ctrValue = impressions > 0 ? (clicks / impressions) * 100 : 0;

  return {
    ad_id: ad.id,
    title: ad.title,
    placement: ad.placement,
    is_active: ad.is_active,
    priority: ad.priority,
    created_at: ad.created_at,
    impressions,
    clicks,
    ctr: ctrValue.toFixed(2),
    ctr_value: Number(ctrValue.toFixed(4)),
    unique_click_users: uniqueClickUsers,
    anonymous_clicks: anonymousClicks,
    clicks_by_user_type: clicksByUserType,
    recent_click_users: recentClickUsers,
    recent_pages: summarizeRecentPages(clickRows, recentPagesLimit),
    last_click_at: clickRows[0]?.clicked_at || null,
  };
}

function sortAnalyticsRows(rows, sortBy, order) {
  const direction = order === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    let left;
    let right;

    if (sortBy === 'ctr') {
      left = a.ctr_value;
      right = b.ctr_value;
    } else if (sortBy === 'clicks') {
      left = a.clicks;
      right = b.clicks;
    } else if (sortBy === 'impressions') {
      left = a.impressions;
      right = b.impressions;
    } else if (sortBy === 'unique_click_users') {
      left = a.unique_click_users;
      right = b.unique_click_users;
    } else {
      left = a.last_click_at ? new Date(a.last_click_at).getTime() : new Date(a.created_at || 0).getTime();
      right = b.last_click_at ? new Date(b.last_click_at).getTime() : new Date(b.created_at || 0).getTime();
    }

    if (left === right) {
      return (b.priority - a.priority) * direction;
    }

    return left > right ? direction : -direction;
  });
}

// ── Public ────────────────────────────────────────────────────

exports.listPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, tag } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase
      .from('blog_posts')
      .select('id,slug,title,excerpt,cover_image_url,category,tags,read_time_mins,published_at,author_id', { count: 'exact' })
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(from, to);

    if (category) query = query.eq('category', category);
    if (tag) query = query.contains('tags', [tag]);

    const { data, error, count } = await query;
    if (error) throw error;

    return sendPaginated(res, data || [], count || 0, Number(page), Number(limit));
  } catch (error) {
    logger.error('listPosts failed', { message: error.message });
    return sendError(res, 'Failed to list blog posts', 500);
  }
};

exports.getPost = async (req, res) => {
  try {
    const { slug } = req.params;
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !data) return sendError(res, 'Post not found', 404);

    // Record read (fire-and-forget)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    Promise.resolve(
      supabase.from('blog_post_reads').insert({
        post_id: data.id,
        user_id: req.user?.id || null,
        ip_hash: hashIp(ip),
        referrer: req.headers.referer || null,
      })
    ).catch((readErr) => {
      logger.warn('blog_post_reads insert failed', { message: readErr?.message });
    });

    return sendSuccess(res, data);
  } catch (error) {
    logger.error('getPost failed', { message: error.message });
    return sendError(res, 'Failed to get post', 500);
  }
};

exports.trackLinkClick = async (req, res) => {
  try {
    const { slug } = req.params;
    const { url } = req.body;

    const { data: post } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (!post) return sendError(res, 'Post not found', 404);

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await supabase.from('blog_link_clicks').insert({
      post_id: post.id,
      url: url || '',
      user_id: req.user?.id || null,
      ip_hash: hashIp(ip),
    });

    return sendSuccess(res, null, 'Click recorded');
  } catch (error) {
    logger.error('trackLinkClick failed', { message: error.message });
    return sendError(res, 'Failed to record click', 500);
  }
};

// ── Admin ─────────────────────────────────────────────────────

exports.adminListPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase
      .from('blog_posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    return sendPaginated(res, data || [], count || 0, Number(page), Number(limit));
  } catch (error) {
    logger.error('adminListPosts failed', { message: error.message });
    return sendError(res, 'Failed to list posts', 500);
  }
};

exports.adminCreatePost = async (req, res) => {
  try {
    const { title, slug, excerpt, content, cover_image_url, category, tags, read_time_mins, status, published_at } = req.body;

    if (!title || !slug || !content) return sendError(res, 'title, slug and content are required', 422);

    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title, slug, excerpt, content, cover_image_url,
        category: category || null,
        tags: tags || [],
        read_time_mins: read_time_mins || 1,
        status: status || 'draft',
        published_at: status === 'published' ? (published_at || new Date().toISOString()) : null,
        author_id: req.supabaseUser.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return sendError(res, 'Slug already exists', 409);
      throw error;
    }

    return sendSuccess(res, data, 'Post created', 201);
  } catch (error) {
    logger.error('adminCreatePost failed', { message: error.message });
    return sendError(res, 'Failed to create post', 500);
  }
};

exports.adminUpdatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.status === 'published' && !updates.published_at) {
      updates.published_at = new Date().toISOString();
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('blog_posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Post updated');
  } catch (error) {
    logger.error('adminUpdatePost failed', { message: error.message });
    return sendError(res, 'Failed to update post', 500);
  }
};

exports.adminDeletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) throw error;
    return sendSuccess(res, null, 'Post deleted');
  } catch (error) {
    logger.error('adminDeletePost failed', { message: error.message });
    return sendError(res, 'Failed to delete post', 500);
  }
};

exports.adminGetPostAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const [reads, clicks] = await Promise.all([
      supabase.from('blog_post_reads').select('*', { count: 'exact', head: true }).eq('post_id', id),
      supabase.from('blog_link_clicks').select('*', { count: 'exact', head: true }).eq('post_id', id),
    ]);
    return sendSuccess(res, { reads: reads.count || 0, link_clicks: clicks.count || 0 });
  } catch (error) {
    logger.error('adminGetPostAnalytics failed', { message: error.message });
    return sendError(res, 'Failed to get post analytics', 500);
  }
};

// ── Ads (public) ──────────────────────────────────────────────

exports.listAds = async (req, res) => {
  try {
    const { placement, page, limit = 10 } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('ads')
      .select('id,title,image_url,target_url,body_text,placement,priority,page_contexts,in_article_after_paragraph')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('priority', { ascending: false })
      .limit(Number(limit) || 10);

    if (placement) query = query.eq('placement', placement);

    // Filter by page context: show ads targeting this specific page OR targeting "all"
    if (page) {
      const safePageId = page.toString().replace(/[^a-z0-9_]/g, '');
      query = query.or(`page_contexts.cs.{${safePageId}},page_contexts.cs.{all}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('listAds failed', { message: error.message });
    return sendError(res, 'Failed to list ads', 500);
  }
};

exports.getPopupAd = async (req, res) => {
  try {
    const { seen_ids } = req.query;
    const seenList = seen_ids ? seen_ids.split(',').filter(Boolean) : [];
    const today = new Date().toISOString().split('T')[0];

    const { data: popups, error } = await supabase
      .from('ads')
      .select('id,title,image_url,target_url,body_text,max_total_views,max_unique_accounts')
      .eq('is_active', true)
      .eq('placement', 'popup')
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('priority', { ascending: false });

    if (error) throw error;

    for (const popup of (popups || [])) {
      if (seenList.includes(popup.id)) continue;

      let eligible = true;

      if (popup.max_total_views != null) {
        const { count } = await supabase
          .from('ad_impressions')
          .select('id', { count: 'exact', head: true })
          .eq('ad_id', popup.id);
        if ((count || 0) >= popup.max_total_views) eligible = false;
      }

      if (eligible && popup.max_unique_accounts != null) {
        const { data: imps } = await supabase
          .from('ad_impressions')
          .select('user_id')
          .eq('ad_id', popup.id)
          .not('user_id', 'is', null);
        const uniqueCount = new Set((imps || []).map((r) => r.user_id)).size;
        if (uniqueCount >= popup.max_unique_accounts) eligible = false;
      }

      if (eligible) return sendSuccess(res, popup);
    }

    return sendSuccess(res, null);
  } catch (error) {
    logger.error('getPopupAd failed', { message: error.message });
    return sendError(res, 'Failed to get popup ad', 500);
  }
};

exports.trackAdImpression = async (req, res) => {
  try {
    const { id } = req.params;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await supabase.from('ad_impressions').insert({
      ad_id: id,
      user_id: resolveTrackingUserId(req),
      ip_hash: hashIp(ip),
      page_path: req.body.page_path || null,
    });
    return sendSuccess(res, null);
  } catch (error) {
    logger.error('trackAdImpression failed', { message: error.message });
    return sendError(res, 'Failed to record impression', 500);
  }
};

exports.trackAdClick = async (req, res) => {
  try {
    const { id } = req.params;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await supabase.from('ad_clicks').insert({
      ad_id: id,
      user_id: resolveTrackingUserId(req),
      ip_hash: hashIp(ip),
      page_path: req.body.page_path || null,
    });
    return sendSuccess(res, null);
  } catch (error) {
    logger.error('trackAdClick failed', { message: error.message });
    return sendError(res, 'Failed to record click', 500);
  }
};

// ── Ads (admin) ───────────────────────────────────────────────

exports.adminListAds = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('adminListAds failed', { message: error.message });
    return sendError(res, 'Failed to list ads', 500);
  }
};

function clampInArticleParagraph(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 2;
  return Math.min(500, Math.max(1, Math.floor(n)));
}

exports.adminCreateAd = async (req, res) => {
  try {
    const { title, image_url, target_url, body_text, placement, priority, start_date, end_date, is_active, max_total_views, max_unique_accounts, campaign_id, display_order, page_contexts, in_article_after_paragraph } = req.body;
    if (!title) return sendError(res, 'title is required', 422);

    const effectivePlacement = placement || 'sidebar';
    const isPopup = effectivePlacement === 'popup';
    const isInArticle = effectivePlacement === 'in-article';
    const effectivePageContexts = Array.isArray(page_contexts) && page_contexts.length > 0 ? page_contexts : ['all'];

    const { data, error } = await supabase
      .from('ads')
      .insert({
        title,
        image_url: image_url || null,
        target_url: target_url || null,
        body_text: body_text || null,
        placement: effectivePlacement,
        priority: Number(priority) || 0,
        start_date: start_date || null,
        end_date: end_date || null,
        is_active: is_active !== false,
        page_contexts: effectivePageContexts,
        ...(isPopup && { max_total_views: max_total_views ? Number(max_total_views) : null }),
        ...(isPopup && { max_unique_accounts: max_unique_accounts ? Number(max_unique_accounts) : null }),
        campaign_id: campaign_id || null,
        display_order: Number(display_order) || 0,
        ...(isInArticle && { in_article_after_paragraph: clampInArticleParagraph(in_article_after_paragraph) }),
        created_by: req.supabaseUser.id,
      })
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Ad created', 201);
  } catch (error) {
    logger.error('adminCreateAd failed', { message: error.message });
    return sendError(res, 'Failed to create ad', 500);
  }
};

exports.adminUpdateAd = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, image_url, target_url, body_text, placement, priority, start_date, end_date, is_active, max_total_views, max_unique_accounts, campaign_id, display_order, page_contexts, in_article_after_paragraph } = req.body;
    const isPopup = (placement || '') === 'popup';
    const updates = {
      ...(title !== undefined && { title }),
      image_url: image_url || null,
      target_url: target_url || null,
      body_text: body_text || null,
      ...(placement !== undefined && { placement }),
      ...(priority !== undefined && { priority: Number(priority) || 0 }),
      start_date: start_date || null,
      end_date: end_date || null,
      ...(is_active !== undefined && { is_active }),
      ...(page_contexts !== undefined && { page_contexts: Array.isArray(page_contexts) && page_contexts.length > 0 ? page_contexts : ['all'] }),
      ...(isPopup && { max_total_views: max_total_views ? Number(max_total_views) : null }),
      ...(isPopup && { max_unique_accounts: max_unique_accounts ? Number(max_unique_accounts) : null }),
      campaign_id: campaign_id || null,
      display_order: Number(display_order) || 0,
      updated_at: new Date().toISOString(),
      ...(placement !== undefined && placement !== 'in-article'
        ? { in_article_after_paragraph: 2 }
        : in_article_after_paragraph !== undefined
          ? { in_article_after_paragraph: clampInArticleParagraph(in_article_after_paragraph) }
          : {}),
    };
    const { data, error } = await supabase.from('ads').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return sendSuccess(res, data, 'Ad updated');
  } catch (error) {
    logger.error('adminUpdateAd failed', { message: error.message });
    return sendError(res, 'Failed to update ad', 500);
  }
};

exports.adminDeleteAd = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('ads').delete().eq('id', id);
    if (error) throw error;
    return sendSuccess(res, null, 'Ad deleted');
  } catch (error) {
    logger.error('adminDeleteAd failed', { message: error.message });
    return sendError(res, 'Failed to delete ad', 500);
  }
};

exports.adminGetAdAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: ad, error } = await supabase
      .from('ads')
      .select('id,title,placement,is_active,priority,created_at')
      .eq('id', id)
      .single();

    if (error || !ad) return sendError(res, 'Ad not found', 404);

    const analytics = await buildAdAnalytics(ad, { recentUsersLimit: 20, recentPagesLimit: 10 });
    return sendSuccess(res, analytics);
  } catch (error) {
    logger.error('adminGetAdAnalytics failed', { message: error.message });
    return sendError(res, 'Failed to get ad analytics', 500);
  }
};

exports.adminListAdsAnalytics = async (req, res) => {
  try {
    const filters = normalizeAnalyticsFilters(req.query || {});

    let query = supabase
      .from('ads')
      .select('id,title,placement,is_active,priority,created_at')
      .order('created_at', { ascending: false })
      .limit(filters.limit);

    if (filters.placement) {
      query = query.eq('placement', filters.placement);
    }

    const { data: ads, error } = await query;
    if (error) throw error;

    const analyticsRows = await Promise.all(
      (ads || []).map((ad) => buildAdAnalytics(ad, { recentUsersLimit: 8, recentPagesLimit: 5 }))
    );

    let filteredRows = analyticsRows.filter((row) => row.clicks >= filters.min_clicks && row.ctr_value >= filters.min_ctr);

    if (filters.user_type) {
      filteredRows = filteredRows.filter((row) => (row.clicks_by_user_type?.[filters.user_type] || 0) > 0);
    }

    const sortedRows = sortAnalyticsRows(filteredRows, filters.sort_by, filters.order);

    return sendSuccess(res, {
      filters,
      total_ads_analyzed: sortedRows.length,
      best_performing_ad: sortedRows[0] || null,
      ads: sortedRows,
    });
  } catch (error) {
    logger.error('adminListAdsAnalytics failed', { message: error.message });
    return sendError(res, 'Failed to list ad analytics', 500);
  }
};

// ── Popup Campaigns ───────────────────────────────────────────

async function isAdEligible(adId, maxTotalViews, maxUniqueAccounts) {
  if (maxTotalViews != null) {
    const { count } = await supabase
      .from('ad_impressions').select('id', { count: 'exact', head: true }).eq('ad_id', adId);
    if ((count || 0) >= maxTotalViews) return false;
  }
  if (maxUniqueAccounts != null) {
    const { data } = await supabase
      .from('ad_impressions').select('user_id').eq('ad_id', adId).not('user_id', 'is', null);
    if (new Set((data || []).map((r) => r.user_id)).size >= maxUniqueAccounts) return false;
  }
  return true;
}

exports.getCampaignPopups = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: campaigns, error: cErr } = await supabase
      .from('popup_campaigns')
      .select('id,title,show_on_login,show_on_interval,interval_minutes')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (cErr) throw cErr;
    if (!campaigns?.length) return sendSuccess(res, []);

    const result = [];
    for (const campaign of campaigns) {
      const { data: ads } = await supabase
        .from('ads')
        .select('id,title,image_url,target_url,body_text,max_total_views,max_unique_accounts,display_order')
        .eq('campaign_id', campaign.id)
        .eq('is_active', true)
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order('display_order', { ascending: true });

      const eligibleAds = [];
      for (const ad of (ads || [])) {
        const ok = await isAdEligible(ad.id, ad.max_total_views, ad.max_unique_accounts);
        if (ok) eligibleAds.push(ad);
      }

      if (eligibleAds.length > 0) {
        result.push({ ...campaign, ads: eligibleAds });
      }
    }

    return sendSuccess(res, result);
  } catch (error) {
    logger.error('getCampaignPopups failed', { message: error.message });
    return sendError(res, 'Failed to get popup campaigns', 500);
  }
};

exports.adminListCampaigns = async (req, res) => {
  try {
    const { data: campaigns, error } = await supabase
      .from('popup_campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const result = [];
    for (const c of (campaigns || [])) {
      const { data: ads } = await supabase
        .from('ads')
        .select('id,title,image_url,is_active,display_order,max_total_views,max_unique_accounts')
        .eq('campaign_id', c.id)
        .order('display_order', { ascending: true });
      result.push({ ...c, ads: ads || [] });
    }
    return sendSuccess(res, result);
  } catch (error) {
    logger.error('adminListCampaigns failed', { message: error.message });
    return sendError(res, 'Failed to list campaigns', 500);
  }
};

exports.adminCreateCampaign = async (req, res) => {
  try {
    const { title, is_active, show_on_login, show_on_interval, interval_minutes } = req.body;
    if (!title) return sendError(res, 'title is required', 422);
    const { data, error } = await supabase
      .from('popup_campaigns')
      .insert({
        title,
        is_active: is_active !== false,
        show_on_login: show_on_login !== false,
        show_on_interval: show_on_interval === true,
        interval_minutes: interval_minutes ? Number(interval_minutes) : null,
        created_by: req.supabaseUser.id,
      })
      .select().single();
    if (error) throw error;
    return sendSuccess(res, data, 'Campaign created', 201);
  } catch (error) {
    logger.error('adminCreateCampaign failed', { message: error.message });
    return sendError(res, 'Failed to create campaign', 500);
  }
};

exports.adminUpdateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, is_active, show_on_login, show_on_interval, interval_minutes } = req.body;
    const updates = {
      ...(title !== undefined && { title }),
      ...(is_active !== undefined && { is_active }),
      ...(show_on_login !== undefined && { show_on_login }),
      ...(show_on_interval !== undefined && { show_on_interval }),
      interval_minutes: interval_minutes ? Number(interval_minutes) : null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('popup_campaigns').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return sendSuccess(res, data, 'Campaign updated');
  } catch (error) {
    logger.error('adminUpdateCampaign failed', { message: error.message });
    return sendError(res, 'Failed to update campaign', 500);
  }
};

exports.adminDeleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    // Unlink ads from campaign before deleting
    await supabase.from('ads').update({ campaign_id: null }).eq('campaign_id', id);
    const { error } = await supabase.from('popup_campaigns').delete().eq('id', id);
    if (error) throw error;
    return sendSuccess(res, null, 'Campaign deleted');
  } catch (error) {
    logger.error('adminDeleteCampaign failed', { message: error.message });
    return sendError(res, 'Failed to delete campaign', 500);
  }
};
