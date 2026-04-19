const supabase = require("../config/database");
const { sendSuccess, sendError, sendPaginated } = require("../utils/responseHelper");
const logger = require("../utils/logger");

function normalizeType(value) {
  const v = String(value || "").trim().toLowerCase();
  return ["job", "contest", "opportunity"].includes(v) ? v : null;
}

function normalizeStatus(value) {
  const v = String(value || "").trim().toLowerCase();
  return ["live", "coming_soon", "ended"].includes(v) ? v : null;
}

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120);
}

// Public
exports.listPublicOpportunities = async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    const status = normalizeStatus(req.query.status);

    let query = supabase
      .from("opportunities")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error("listPublicOpportunities failed", { message: error.message });
    return sendError(res, "Failed to load opportunities", 500);
  }
};

exports.submitOpportunityApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      applicant_name,
      applicant_email,
      applicant_phone,
      applicant_company,
      applicant_message,
      resume_url,
      resume_filename,
      portfolio_url,
      portfolio_label,
    } = req.body || {};

    if (!applicant_name || !applicant_email) {
      return sendError(res, "Name and email are required", 422);
    }

    const { data: opportunity, error: oppError } = await supabase
      .from("opportunities")
      .select("id,type,status,is_published,title")
      .eq("id", id)
      .maybeSingle();

    if (oppError) throw oppError;
    if (!opportunity || !opportunity.is_published) {
      return sendError(res, "Opportunity not found", 404);
    }
    if (opportunity.status !== "live") {
      return sendError(res, "This listing is not accepting applications right now", 409);
    }

    const { data, error } = await supabase
      .from("opportunity_applications")
      .insert({
        opportunity_id: opportunity.id,
        applicant_name: String(applicant_name).trim(),
        applicant_email: String(applicant_email).trim().toLowerCase(),
        applicant_phone: applicant_phone ? String(applicant_phone).trim() : null,
        applicant_company: applicant_company ? String(applicant_company).trim() : null,
        applicant_message: applicant_message ? String(applicant_message).trim() : null,
        resume_url: resume_url ? String(resume_url).trim() : null,
        resume_filename: resume_filename ? String(resume_filename).trim() : null,
        portfolio_url: portfolio_url ? String(portfolio_url).trim() : null,
        portfolio_label: portfolio_label ? String(portfolio_label).trim() : null,
        submitted_by: req.user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, data, "Application submitted", 201);
  } catch (error) {
    logger.error("submitOpportunityApplication failed", { message: error.message });
    return sendError(res, "Failed to submit application", 500);
  }
};

// Admin
exports.adminListOpportunities = async (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    const status = normalizeStatus(req.query.status);
    const published = req.query.published;

    let query = supabase
      .from("opportunities")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    if (published === "true" || published === "false") {
      query = query.eq("is_published", published === "true");
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error("adminListOpportunities failed", { message: error.message });
    return sendError(res, "Failed to list opportunities", 500);
  }
};

exports.adminCreateOpportunity = async (req, res) => {
  try {
    const type = normalizeType(req.body?.type);
    const status = normalizeStatus(req.body?.status) || "coming_soon";
    const title = String(req.body?.title || "").trim();
    const slugInput = String(req.body?.slug || "").trim();
    const slug = slugInput ? slugify(slugInput) : slugify(title);

    if (!type) return sendError(res, "Invalid type", 422);
    if (!title) return sendError(res, "Title is required", 422);
    if (!slug) return sendError(res, "Slug is required", 422);

    const payload = {
      type,
      status,
      title,
      slug,
      summary: req.body?.summary ? String(req.body.summary).trim() : null,
      details: req.body?.details ? String(req.body.details).trim() : null,
      location: req.body?.location ? String(req.body.location).trim() : null,
      department: req.body?.department ? String(req.body.department).trim() : null,
      employment_type: req.body?.employment_type ? String(req.body.employment_type).trim() : null,
      compensation: req.body?.compensation ? String(req.body.compensation).trim() : null,
      cta_label: req.body?.cta_label ? String(req.body.cta_label).trim() : null,
      cta_url: req.body?.cta_url ? String(req.body.cta_url).trim() : null,
      starts_at: parseTimestamp(req.body?.starts_at),
      ends_at: parseTimestamp(req.body?.ends_at),
      application_deadline: parseTimestamp(req.body?.application_deadline),
      sort_order: Number.isFinite(Number(req.body?.sort_order)) ? Number(req.body.sort_order) : 0,
      is_published: toBool(req.body?.is_published, false),
      created_by: req.supabaseUser?.id || req.user?.supabase_uid || null,
    };

    const { data, error } = await supabase
      .from("opportunities")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return sendError(res, "Slug already exists", 409);
      throw error;
    }

    return sendSuccess(res, data, "Opportunity created", 201);
  } catch (error) {
    logger.error("adminCreateOpportunity failed", { message: error.message });
    return sendError(res, "Failed to create opportunity", 500);
  }
};

exports.adminUpdateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (req.body?.type !== undefined) {
      const type = normalizeType(req.body.type);
      if (!type) return sendError(res, "Invalid type", 422);
      updates.type = type;
    }

    if (req.body?.status !== undefined) {
      const status = normalizeStatus(req.body.status);
      if (!status) return sendError(res, "Invalid status", 422);
      updates.status = status;
    }

    if (req.body?.title !== undefined) updates.title = String(req.body.title || "").trim();
    if (req.body?.slug !== undefined) {
      const slug = slugify(req.body.slug);
      if (!slug) return sendError(res, "Invalid slug", 422);
      updates.slug = slug;
    }
    if (req.body?.summary !== undefined) updates.summary = req.body.summary ? String(req.body.summary).trim() : null;
    if (req.body?.details !== undefined) updates.details = req.body.details ? String(req.body.details).trim() : null;
    if (req.body?.location !== undefined) updates.location = req.body.location ? String(req.body.location).trim() : null;
    if (req.body?.department !== undefined) updates.department = req.body.department ? String(req.body.department).trim() : null;
    if (req.body?.employment_type !== undefined) updates.employment_type = req.body.employment_type ? String(req.body.employment_type).trim() : null;
    if (req.body?.compensation !== undefined) updates.compensation = req.body.compensation ? String(req.body.compensation).trim() : null;
    if (req.body?.cta_label !== undefined) updates.cta_label = req.body.cta_label ? String(req.body.cta_label).trim() : null;
    if (req.body?.cta_url !== undefined) updates.cta_url = req.body.cta_url ? String(req.body.cta_url).trim() : null;
    if (req.body?.starts_at !== undefined) updates.starts_at = parseTimestamp(req.body.starts_at);
    if (req.body?.ends_at !== undefined) updates.ends_at = parseTimestamp(req.body.ends_at);
    if (req.body?.application_deadline !== undefined) {
      updates.application_deadline = parseTimestamp(req.body.application_deadline);
    }
    if (req.body?.sort_order !== undefined) updates.sort_order = Number(req.body.sort_order) || 0;
    if (req.body?.is_published !== undefined) updates.is_published = toBool(req.body.is_published, false);

    const { data, error } = await supabase
      .from("opportunities")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return sendError(res, "Slug already exists", 409);
      throw error;
    }
    if (!data) return sendError(res, "Opportunity not found", 404);

    return sendSuccess(res, data, "Opportunity updated");
  } catch (error) {
    logger.error("adminUpdateOpportunity failed", { message: error.message });
    return sendError(res, "Failed to update opportunity", 500);
  }
};

exports.adminDeleteOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("opportunities").delete().eq("id", id);
    if (error) throw error;
    return sendSuccess(res, null, "Opportunity deleted");
  } catch (error) {
    logger.error("adminDeleteOpportunity failed", { message: error.message });
    return sendError(res, "Failed to delete opportunity", 500);
  }
};

exports.adminListApplications = async (req, res) => {
  try {
    const opportunityId = String(req.query.opportunity_id || "").trim();
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("opportunity_applications")
      .select(`
        *,
        opportunities:opportunities!opportunity_applications_opportunity_id_fkey(id,title,type,status)
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (opportunityId) query = query.eq("opportunity_id", opportunityId);
    if (status) query = query.eq("status", status);
    if (q) {
      const safeQ = q.replace(/[,%]/g, "").slice(0, 80);
      query = query.or(
        `applicant_name.ilike.%${safeQ}%,applicant_email.ilike.%${safeQ}%,applicant_company.ilike.%${safeQ}%`
      );
    }
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return sendPaginated(res, data || [], count || 0, page, limit, "Applications loaded");
  } catch (error) {
    logger.error("adminListApplications failed", { message: error.message });
    return sendError(res, "Failed to list applications", 500);
  }
};

exports.adminUpdateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = new Set(["new", "reviewing", "shortlisted", "rejected", "accepted"]);
    const status = String(req.body?.status || "").trim();
    if (!allowed.has(status)) return sendError(res, "Invalid application status", 422);

    const { data, error } = await supabase
      .from("opportunity_applications")
      .update({
        status,
        reviewed_by: req.supabaseUser?.id || req.user?.supabase_uid || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return sendError(res, "Application not found", 404);
    return sendSuccess(res, data, "Application updated");
  } catch (error) {
    logger.error("adminUpdateApplication failed", { message: error.message });
    return sendError(res, "Failed to update application", 500);
  }
};
