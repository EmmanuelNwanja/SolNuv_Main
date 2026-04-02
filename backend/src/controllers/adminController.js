const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { logPlatformActivity } = require('../services/auditService');
const logger = require('../utils/logger');

exports.getOverview = async (req, res) => {
  try {
    const nowIso = new Date().toISOString();

    const [
      usersCount,
      companiesCount,
      projectsCount,
      activeSubscriptions,
      monthlyRevenue,
      pendingPush,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .neq('subscription_plan', 'free')
        .gte('subscription_expires_at', nowIso),
      supabase
        .from('subscription_transactions')
        .select('amount_ngn, paid_at')
        .gte('paid_at', new Date(Date.now() - (30 * 24 * 3600 * 1000)).toISOString()),
      supabase
        .from('push_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued'),
    ]);

    const revenue30d = (monthlyRevenue.data || []).reduce((sum, tx) => sum + Number(tx.amount_ngn || 0), 0);

    return sendSuccess(res, {
      users: usersCount.count || 0,
      companies: companiesCount.count || 0,
      projects: projectsCount.count || 0,
      active_subscriptions: activeSubscriptions.count || 0,
      revenue_30d_ngn: revenue30d,
      queued_push_notifications: pendingPush.count || 0,
    });
  } catch (error) {
    logger.error('Failed to load admin overview', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to load admin overview', 500);
  }
};

exports.listUsers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    const baseSelect = 'id, first_name, last_name, email, role, is_active, created_at, company_id';
    const enrichedSelect = `${baseSelect}, companies:companies!users_company_id_fkey(name, subscription_plan, subscription_expires_at, subscription_interval, max_team_members), admin_users:admin_users!admin_users_user_id_fkey(role, is_active)`;

    let query = supabase
      .from('users')
      .select(enrichedSelect, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    let { data, error, count } = await query;
    if (error) {
      // Fallback for environments where FK names differ from migration defaults.
      let fallbackQuery = supabase
        .from('users')
        .select(baseSelect, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search) {
        fallbackQuery = fallbackQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const fallback = await fallbackQuery;
      data = fallback.data;
      count = fallback.count;
      error = fallback.error;
    }

    if (error) throw error;

    return sendSuccess(res, {
      users: data || [],
      total: count || 0,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    logger.error('Failed to fetch admin users', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to fetch users', 500);
  }
};

exports.updateUserVerification = async (req, res) => {
  try {
    const { user_id, is_active, company_verified, company_plan } = req.body;
    if (!user_id) return sendError(res, 'user_id is required', 400);

    const { data: targetUser } = await supabase
      .from('users')
      .select('id, email, company_id')
      .eq('id', user_id)
      .single();

    if (!targetUser) return sendError(res, 'User not found', 404);

    if (typeof is_active === 'boolean') {
      await supabase.from('users').update({ is_active }).eq('id', user_id);
    }

    if (targetUser.company_id) {
      const companyUpdate = {};
      if (typeof company_verified === 'boolean') {
        companyUpdate.verified_at = company_verified ? new Date().toISOString() : null;
        companyUpdate.verified_by = company_verified ? req.user.id : null;
      }
      if (company_plan) companyUpdate.subscription_plan = company_plan;

      if (Object.keys(companyUpdate).length > 0) {
        await supabase.from('companies').update(companyUpdate).eq('id', targetUser.company_id);
      }
    }

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'admin.user.updated',
      resourceType: 'user',
      resourceId: user_id,
      details: { is_active, company_verified, company_plan },
    });

    return sendSuccess(res, { user_id }, 'User updated');
  } catch (error) {
    logger.error('Failed to update user verification', { admin_user_id: req.user?.id || null, target_user_id: req.body?.user_id || null, message: error.message });
    return sendError(res, 'Failed to update user', 500);
  }
};

exports.listPaystackPlans = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('paystack_plan_catalog')
      .select('*')
      .order('plan_key', { ascending: true });

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('Failed to fetch Paystack plans', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to fetch Paystack plans', 500);
  }
};

exports.upsertPaystackPlan = async (req, res) => {
  try {
    const {
      plan_key,
      paystack_plan_code,
      amount_kobo,
      interval,
      display_name,
      active = true,
    } = req.body;

    if (!plan_key || !paystack_plan_code || !amount_kobo || !interval || !display_name) {
      return sendError(res, 'plan_key, paystack_plan_code, amount_kobo, interval, display_name are required', 400);
    }

    const payload = {
      plan_key,
      paystack_plan_code,
      amount_kobo,
      interval,
      display_name,
      active,
    };

    const { error } = await supabase
      .from('paystack_plan_catalog')
      .upsert(payload, { onConflict: 'plan_key' });

    if (error) throw error;

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'admin.paystack_plan.upserted',
      resourceType: 'paystack_plan_catalog',
      resourceId: plan_key,
      details: payload,
    });

    return sendSuccess(res, payload, 'Paystack plan saved');
  } catch (error) {
    logger.error('Failed to save Paystack plan', { admin_user_id: req.user?.id || null, plan_key: req.body?.plan_key || null, message: error.message });
    return sendError(res, 'Failed to save Paystack plan', 500);
  }
};

exports.listPromoCodes = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('Failed to load promo codes', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to load promo codes', 500);
  }
};

exports.createPromoCode = async (req, res) => {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      max_redemptions,
      starts_at,
      ends_at,
      applies_to_plans,
      applies_to_intervals,
    } = req.body;

    if (!code || !discount_type || !discount_value) {
      return sendError(res, 'code, discount_type, and discount_value are required', 400);
    }

    const payload = {
      code: String(code).toUpperCase().trim(),
      description,
      discount_type,
      discount_value,
      max_redemptions: max_redemptions || null,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
      applies_to_plans: applies_to_plans || ['pro', 'elite', 'enterprise'],
      applies_to_intervals: applies_to_intervals || ['monthly', 'annual'],
      created_by: req.user.id,
      active: true,
    };

    const { data, error } = await supabase
      .from('promo_codes')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'admin.promo.created',
      resourceType: 'promo_codes',
      resourceId: data.id,
      details: { code: data.code },
    });

    return sendSuccess(res, data, 'Promo code created', 201);
  } catch (error) {
    logger.error('Failed to create promo code', { admin_user_id: req.user?.id || null, code: req.body?.code || null, message: error.message });
    return sendError(res, 'Failed to create promo code', 500);
  }
};

exports.togglePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const { data, error } = await supabase
      .from('promo_codes')
      .update({ active: !!active })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) return sendError(res, 'Promo code not found', 404);

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'admin.promo.toggled',
      resourceType: 'promo_codes',
      resourceId: id,
      details: { active: !!active },
    });

    return sendSuccess(res, data, 'Promo code updated');
  } catch (error) {
    logger.error('Failed to update promo code', { admin_user_id: req.user?.id || null, promo_id: req.params?.id || null, message: error.message });
    return sendError(res, 'Failed to update promo code', 500);
  }
};

exports.getFinance = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscription_transactions')
      .select('*')
      .order('paid_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const summary = (data || []).reduce((acc, tx) => {
      acc.revenue_ngn += Number(tx.amount_ngn || 0);
      acc.discounts_ngn += Number(tx.discount_amount_ngn || 0);
      acc.transactions += 1;
      return acc;
    }, { revenue_ngn: 0, discounts_ngn: 0, transactions: 0 });

    return sendSuccess(res, { summary, transactions: data || [] });
  } catch (error) {
    logger.error('Failed to load finance data', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to load finance data', 500);
  }
};

exports.sendPushNotification = async (req, res) => {
  try {
    const { title, message, target_type = 'all', target_value = null } = req.body;
    if (!title || !message) return sendError(res, 'title and message are required', 400);

    const payload = {
      title,
      message,
      target_type,
      target_value,
      sent_by: req.user.id,
      sent_at: new Date().toISOString(),
      status: 'sent',
      metadata: { source: 'admin_dashboard' },
    };

    const { data: pushRow, error: pushError } = await supabase
      .from('push_notifications')
      .insert(payload)
      .select('*')
      .single();

    if (pushError) throw pushError;

    let notificationQuery = supabase
      .from('users')
      .select('id, company_id, companies(subscription_plan)')
      .eq('is_active', true);

    if (target_type === 'user' && target_value) notificationQuery = notificationQuery.eq('id', target_value);
    const { data: users } = await notificationQuery;

    const recipients = (users || []).filter((u) => {
      if (target_type === 'plan') return u.companies?.subscription_plan === target_value;
      if (target_type === 'company') return u.company_id === target_value;
      return true;
    });

    if (recipients.length > 0) {
      await supabase.from('notifications').insert(
        recipients.map((u) => ({
          user_id: u.id,
          type: 'report_ready',
          title,
          message,
          data: { push_notification_id: pushRow.id, target_type, target_value },
        }))
      );
    }

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'admin.push.sent',
      resourceType: 'push_notifications',
      resourceId: pushRow.id,
      details: { target_type, target_value, recipients: recipients.length },
    });

    return sendSuccess(res, { push_notification: pushRow, recipients: recipients.length }, 'Notification sent');
  } catch (error) {
    logger.error('Failed to send push notification', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to send push notification', 500);
  }
};

exports.getActivityLogs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('platform_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('Failed to load activity logs', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to load activity logs', 500);
  }
};

exports.listAdmins = async (req, res) => {
  try {
    const enriched = await supabase
      .from('admin_users')
      .select('id, role, is_active, can_manage_admins, created_at, user_id, users:users!admin_users_user_id_fkey(first_name, last_name, email)')
      .order('created_at', { ascending: false });

    let data = enriched.data;
    let error = enriched.error;

    if (error) {
      // Fallback for environments where FK names differ.
      const basic = await supabase
        .from('admin_users')
        .select('id, role, is_active, can_manage_admins, created_at, user_id')
        .order('created_at', { ascending: false });

      data = basic.data;
      error = basic.error;
    }

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('Failed to load admins', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to load admins', 500);
  }
};

exports.upsertAdmin = async (req, res) => {
  try {
    const { user_id, role, is_active = true, can_manage_admins = false } = req.body;
    if (!user_id || !role) return sendError(res, 'user_id and role are required', 400);

    const payload = { user_id, role, is_active, can_manage_admins, created_by: req.user.id };
    const { error } = await supabase.from('admin_users').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'admin.admin_user.upserted',
      resourceType: 'admin_users',
      resourceId: user_id,
      details: { role, is_active, can_manage_admins },
    });

    return sendSuccess(res, payload, 'Admin privileges updated');
  } catch (error) {
    logger.error('Failed to update admin privileges', { admin_user_id: req.user?.id || null, target_user_id: req.body?.user_id || null, message: error.message });
    return sendError(res, 'Failed to update admin privileges', 500);
  }
};

/**
 * GET /api/admin/otps
 * List pending password reset OTPs
 */
exports.getOtps = async (req, res) => {
  try {
    const { data: otps, error } = await supabase
      .from('password_reset_otps')
      .select('id, email, phone, otp_code, channel, expires_at, used, attempts, created_at')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map to frontend format and mask sensitive data
    const mapped = (otps || []).map(otp => ({
      ...otp,
      otp_code_masked: `${otp.otp_code.substring(0, 2)}****`, // Show only first 2 digits
      phone_masked: `${otp.phone.substring(0, otp.phone.length - 4)}****`, // Hide last 4 digits
      expires_in_minutes: Math.ceil((new Date(otp.expires_at) - new Date()) / 60000),
    }));

    return sendSuccess(res, mapped);
  } catch (error) {
    logger.error('Failed to load OTPs', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to load OTPs', 500);
  }
};

/**
 * POST /api/admin/otps
 * Generate single-use OTP for a user (for manual delivery if SMS fails)
 */
exports.generateOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone) return sendError(res, 'email and phone are required', 400);

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = String(phone).trim();

    // Optional profile lookup (for audit metadata only).
    // New Google signups may not have a `users` row yet until onboarding completes.
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    // Generate 6-digit OTP
    const otp_code = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Delete any existing unused OTPs for this email
    await supabase.from('password_reset_otps')
      .delete()
      .eq('email', normalizedEmail)
      .eq('used', false);

    // Create new OTP
    const { data: newOtp, error: otpError } = await supabase
      .from('password_reset_otps')
      .insert({
        email: normalizedEmail,
        phone: normalizedPhone,
        otp_code,
        channel: 'admin_generated',
        expires_at,
      })
      .select()
      .single();

    if (otpError) throw otpError;

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'admin.otp.generated',
      resourceType: 'password_reset_otps',
      resourceId: newOtp.id,
      details: {
        target_email: normalizedEmail,
        target_phone: normalizedPhone,
        target_profile_user_id: user?.id || null,
      },
    });

    return sendSuccess(res, {
      id: newOtp.id,
      email: newOtp.email,
      phone: newOtp.phone,
      otp_code: newOtp.otp_code,
      expires_at: newOtp.expires_at,
      message: 'OTP generated. Manually share with user if SMS delivery failed.',
    }, 'OTP created', 201);
  } catch (error) {
    console.error('admin.generateOtp error:', error);
    return sendError(res, 'Failed to generate OTP', 500);
  }
};

/**
 * GET /api/admin/projects
 * List ALL projects across the platform with owner + geo verification details.
 */
exports.listAllProjects = async (req, res) => {
  try {
    const { search = '', status = '', geo_verified = '', page = 1, limit = 30 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase
      .from('projects')
      .select(
        `id, name, state, city, address, status, geo_source, geo_verified, geo_verified_at,
         is_delisted, installation_date, created_at, total_system_size_kw, project_photo_url,
         users!projects_user_id_fkey(id, first_name, last_name, email, brand_name),
         companies!projects_company_id_fkey(id, name, email, phone)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%`);
    if (status) query = query.eq('status', status);
    if (geo_verified === 'true') query = query.eq('geo_verified', true);
    if (geo_verified === 'false') query = query.eq('geo_verified', false);

    const { data, error, count } = await query;
    if (error) throw error;

    const enriched = (data || []).map((p) => {
      const owner = p.users || {};
      const company = p.companies || {};
      const brandName = company.name || owner.brand_name || `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
      const contactEmail = company.email || owner.email || null;

      const verificationStatus = p.geo_verified
        ? 'Verified'
        : p.geo_source === 'image_exif'
          ? 'Authenticated'
          : 'Unverified';

      return {
        id: p.id,
        name: p.name,
        brand_name: brandName,
        brand_email: contactEmail,
        state: p.state,
        city: p.city,
        address: p.address,
        status: p.status,
        geo_source: p.geo_source,
        geo_verified: p.geo_verified,
        geo_verified_at: p.geo_verified_at,
        verification_status: verificationStatus,
        is_delisted: p.is_delisted,
        installation_date: p.installation_date,
        created_at: p.created_at,
        total_system_size_kw: p.total_system_size_kw,
        project_photo_url: p.project_photo_url,
        owner_id: owner.id || null,
        company_id: p.companies?.id || null,
      };
    });

    return sendSuccess(res, { projects: enriched, total: count || 0, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Admin: Failed to list projects', { admin_user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to list projects', 500);
  }
};

/**
 * PATCH /api/admin/projects/:id
 * Admin can adjust: status, geo_verified, is_delisted
 */
exports.adminUpdateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, geo_verified, is_delisted } = req.body;

    const allowedStatuses = ['active', 'decommissioned', 'recycled', 'pending_recovery'];
    const updatePayload = {};

    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) return sendError(res, 'Invalid status value', 400);
      updatePayload.status = status;
      if (status === 'decommissioned') updatePayload.actual_decommission_date = new Date().toISOString().split('T')[0];
    }

    if (typeof geo_verified === 'boolean') {
      updatePayload.geo_verified = geo_verified;
      updatePayload.geo_verified_by = geo_verified ? req.user.id : null;
      updatePayload.geo_verified_at = geo_verified ? new Date().toISOString() : null;
    }

    if (typeof is_delisted === 'boolean') {
      updatePayload.is_delisted = is_delisted;
    }

    if (Object.keys(updatePayload).length === 0) {
      return sendError(res, 'No valid fields to update', 400);
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', id)
      .select('id, name, status, geo_verified, is_delisted')
      .single();

    if (error) throw error;
    if (!data) return sendError(res, 'Project not found', 404);

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'admin.project.updated',
      resourceType: 'projects',
      resourceId: id,
      details: updatePayload,
    });

    return sendSuccess(res, data, 'Project updated');
  } catch (error) {
    logger.error('Admin: Failed to update project', { admin_user_id: req.user?.id || null, project_id: req.params?.id || null, message: error.message });
    return sendError(res, 'Failed to update project', 500);
  }
};

/**
 * PATCH /api/admin/projects/bulk
 * Bulk admin updates for project verification/listing/status controls.
 */
exports.adminBulkUpdateProjects = async (req, res) => {
  try {
    const { project_ids = [], update = {} } = req.body || {};
    if (!Array.isArray(project_ids) || project_ids.length === 0) {
      return sendError(res, 'project_ids is required', 400);
    }

    const allowedStatuses = ['active', 'decommissioned', 'recycled', 'pending_recovery'];
    const updatePayload = {};

    if (update.status !== undefined) {
      if (!allowedStatuses.includes(update.status)) return sendError(res, 'Invalid status value', 400);
      updatePayload.status = update.status;
      if (update.status === 'decommissioned') {
        updatePayload.actual_decommission_date = new Date().toISOString().split('T')[0];
      }
    }

    if (typeof update.geo_verified === 'boolean') {
      updatePayload.geo_verified = update.geo_verified;
      updatePayload.geo_verified_by = update.geo_verified ? req.user.id : null;
      updatePayload.geo_verified_at = update.geo_verified ? new Date().toISOString() : null;
    }

    if (typeof update.is_delisted === 'boolean') {
      updatePayload.is_delisted = update.is_delisted;
    }

    if (Object.keys(updatePayload).length === 0) {
      return sendError(res, 'No valid update fields provided', 400);
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updatePayload)
      .in('id', project_ids)
      .select('id, name, status, geo_verified, is_delisted');

    if (error) throw error;

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'admin.project.bulk_updated',
      resourceType: 'projects',
      resourceId: 'bulk',
      details: { count: project_ids.length, update: updatePayload },
    });

    return sendSuccess(res, {
      updated_count: (data || []).length,
      projects: data || [],
    }, 'Projects updated');
  } catch (error) {
    logger.error('Admin: Failed bulk project update', {
      admin_user_id: req.user?.id || null,
      message: error.message,
      count: Array.isArray(req.body?.project_ids) ? req.body.project_ids.length : 0,
    });
    return sendError(res, 'Failed to bulk update projects', 500);
  }
};
