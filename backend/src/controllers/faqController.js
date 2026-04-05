// backend/src/controllers/faqController.js
const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');

// ── Public ────────────────────────────────────────────────────

/**
 * GET /api/faq
 * Returns all published FAQs grouped by category, ordered by order_index.
 */
exports.listFaqs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('id, question, answer, category, order_index, blog_post_slug, blog_post_label')
      .eq('is_published', true)
      .order('category', { ascending: true })
      .order('order_index', { ascending: true });

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('listFaqs failed', { message: error.message });
    return sendError(res, 'Failed to load FAQs', 500);
  }
};

// ── Admin ─────────────────────────────────────────────────────

/**
 * GET /api/faq/admin
 * Returns all FAQs (published + draft) for admin management.
 */
exports.adminListFaqs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('category', { ascending: true })
      .order('order_index', { ascending: true });

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('adminListFaqs failed', { message: error.message });
    return sendError(res, 'Failed to load FAQs', 500);
  }
};

/**
 * POST /api/faq/admin
 */
exports.adminCreateFaq = async (req, res) => {
  try {
    const { question, answer, category = 'General', order_index = 0, is_published = false, blog_post_slug, blog_post_label } = req.body;

    if (!question?.trim() || !answer?.trim()) {
      return sendError(res, 'question and answer are required', 400);
    }

    const payload = {
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim() || 'General',
      order_index: Number(order_index) || 0,
      is_published,
      blog_post_slug: blog_post_slug?.trim() || null,
      blog_post_label: blog_post_label?.trim() || null,
      created_by: req.user?.supabase_uid || req.user?.id || null,
    };

    const { data, error } = await supabase.from('faqs').insert(payload).select().single();
    if (error) throw error;
    return sendSuccess(res, data, 201);
  } catch (error) {
    logger.error('adminCreateFaq failed', { message: error.message });
    return sendError(res, 'Failed to create FAQ', 500);
  }
};

/**
 * PATCH /api/faq/admin/:id
 */
exports.adminUpdateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, answer, category, order_index, is_published, blog_post_slug, blog_post_label } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (question !== undefined) updates.question = question.trim();
    if (answer !== undefined) updates.answer = answer.trim();
    if (category !== undefined) updates.category = category.trim() || 'General';
    if (order_index !== undefined) updates.order_index = Number(order_index) || 0;
    if (is_published !== undefined) updates.is_published = is_published;
    if (blog_post_slug !== undefined) updates.blog_post_slug = blog_post_slug?.trim() || null;
    if (blog_post_label !== undefined) updates.blog_post_label = blog_post_label?.trim() || null;

    const { data, error } = await supabase.from('faqs').update(updates).eq('id', id).select().single();
    if (error || !data) return sendError(res, 'FAQ not found', 404);
    return sendSuccess(res, data);
  } catch (error) {
    logger.error('adminUpdateFaq failed', { message: error.message });
    return sendError(res, 'Failed to update FAQ', 500);
  }
};

/**
 * DELETE /api/faq/admin/:id
 */
exports.adminDeleteFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('faqs').delete().eq('id', id);
    if (error) throw error;
    return sendSuccess(res, { deleted: true });
  } catch (error) {
    logger.error('adminDeleteFaq failed', { message: error.message });
    return sendError(res, 'Failed to delete FAQ', 500);
  }
};
