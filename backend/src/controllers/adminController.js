const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { logPlatformActivity } = require('../services/auditService');

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
    return sendError(res, 'Failed to load admin overview', 500);
  }
};

exports.listUsers = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabase
      .from('users')
      .select('id, first_name, last_name, email, role, is_active, created_at, company_id, companies(name, subscription_plan, subscription_expires_at, subscription_interval, max_team_members), admin_users(role, is_active)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return sendSuccess(res, {
      users: data || [],
      total: count || 0,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
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
    return sendError(res, 'Failed to load activity logs', 500);
  }
};

exports.listAdmins = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, role, is_active, can_manage_admins, created_at, user_id, users(first_name, last_name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
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
    return sendError(res, 'Failed to update admin privileges', 500);
  }
};
