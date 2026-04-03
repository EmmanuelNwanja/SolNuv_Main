// backend/src/controllers/blogController.js
const supabase = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const crypto = require('crypto');

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + process.env.IP_HASH_SALT || '').digest('hex').slice(0, 16);
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
    supabase.from('blog_post_reads').insert({
      post_id: data.id,
      user_id: req.user?.id || null,
      ip_hash: hashIp(ip),
      referrer: req.headers.referer || null,
    }).then(() => {}).catch(() => {});

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
        author_id: req.user.id,
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
    const { placement } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('ads')
      .select('id,title,image_url,target_url,body_text,placement,priority')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('priority', { ascending: false })
      .limit(10);

    if (placement) query = query.eq('placement', placement);

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('listAds failed', { message: error.message });
    return sendError(res, 'Failed to list ads', 500);
  }
};

exports.trackAdImpression = async (req, res) => {
  try {
    const { id } = req.params;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    await supabase.from('ad_impressions').insert({
      ad_id: id,
      user_id: req.user?.id || null,
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
      user_id: req.user?.id || null,
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

exports.adminCreateAd = async (req, res) => {
  try {
    const { title, image_url, target_url, body_text, placement, priority, start_date, end_date, is_active } = req.body;
    if (!title) return sendError(res, 'title is required', 422);

    const { data, error } = await supabase
      .from('ads')
      .insert({
        title,
        image_url: image_url || null,
        target_url: target_url || null,
        body_text: body_text || null,
        placement: placement || 'sidebar',
        priority: Number(priority) || 0,
        start_date: start_date || null,
        end_date: end_date || null,
        is_active: is_active !== false,
        created_by: req.user.id,
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
    const { title, image_url, target_url, body_text, placement, priority, start_date, end_date, is_active } = req.body;
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
      updated_at: new Date().toISOString(),
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
    const [impressions, clicks] = await Promise.all([
      supabase.from('ad_impressions').select('*', { count: 'exact', head: true }).eq('ad_id', id),
      supabase.from('ad_clicks').select('*', { count: 'exact', head: true }).eq('ad_id', id),
    ]);
    return sendSuccess(res, {
      impressions: impressions.count || 0,
      clicks: clicks.count || 0,
      ctr: impressions.count ? ((clicks.count / impressions.count) * 100).toFixed(2) : '0.00',
    });
  } catch (error) {
    logger.error('adminGetAdAnalytics failed', { message: error.message });
    return sendError(res, 'Failed to get ad analytics', 500);
  }
};
