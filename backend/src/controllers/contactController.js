// backend/src/controllers/contactController.js
const supabase = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');
const logger = require('../utils/logger');

// Simple rate-limit store (in-memory, cleared on restart — good enough for basic abuse prevention)
const ipSubmitTimes = new Map();

exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) return sendError(res, 'name, email and message are required', 422);

    // Rudimentary rate-limit: max 3 per IP per hour
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const now = Date.now();
    const times = (ipSubmitTimes.get(ip) || []).filter((t) => now - t < 3600_000);
    if (times.length >= 3) return sendError(res, 'Too many submissions. Please try again later.', 429);
    ipSubmitTimes.set(ip, [...times, now]);

    const { data, error } = await supabase
      .from('contact_submissions')
      .insert({ name, email: email.toLowerCase().trim(), phone: phone || null, subject: subject || null, message })
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, { id: data.id }, 'Message received. We will get back to you shortly.', 201);
  } catch (error) {
    logger.error('submitContact failed', { message: error.message });
    return sendError(res, 'Failed to submit message', 500);
  }
};

// ── Admin ─────────────────────────────────────────────────────

exports.adminListSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase
      .from('contact_submissions')
      .select('*', { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;
    return sendPaginated(res, data || [], count || 0, Number(page), Number(limit));
  } catch (error) {
    logger.error('adminListSubmissions failed', { message: error.message });
    return sendError(res, 'Failed to list submissions', 500);
  }
};

exports.adminUpdateSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const updates = { status, admin_notes };
    if (status === 'resolved') {
      updates.resolved_by = req.user.id;
      updates.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('contact_submissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Submission updated');
  } catch (error) {
    logger.error('adminUpdateSubmission failed', { message: error.message });
    return sendError(res, 'Failed to update submission', 500);
  }
};

exports.adminDeleteSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('contact_submissions').delete().eq('id', id);
    if (error) throw error;
    return sendSuccess(res, null, 'Submission deleted');
  } catch (error) {
    logger.error('adminDeleteSubmission failed', { message: error.message });
    return sendError(res, 'Failed to delete submission', 500);
  }
};
