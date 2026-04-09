const { sendSms } = require('./termiiService');
const logger = require('../utils/logger');

async function sendWelcomeNotification(user) {
  const phone = user?.phone;
  if (!phone) return { success: false, reason: 'User phone missing' };

  const message = `Welcome to SolNuv, ${user.first_name || 'Engineer'}! Your account is ready. Track projects, compliance, and recovery from your dashboard.`;
  return sendSms({ to: phone, message, channel: 'generic' });
}

async function sendPaymentConfirmation(user, plan, amount, billingInterval = 'monthly') {
  const phone = user?.phone;
  if (!phone) return { success: false, reason: 'User phone missing' };

  const intervalLabel = billingInterval === 'annual' ? 'annual' : 'monthly';
  const message = `SolNuv: Payment confirmed. ${plan} ${intervalLabel} subscription active. Amount: N${Math.round(Number(amount || 0)).toLocaleString('en-NG')}.`;
  return sendSms({ to: phone, message, channel: 'generic' });
}

async function sendRecoveryConfirmation(user, project) {
  const phone = user?.phone;
  if (!phone) return { success: false, reason: 'User phone missing' };

  const message = `SolNuv: Recovery request for ${project?.name || 'your project'} submitted. A certified partner will contact you within 24 hours.`;
  return sendSms({ to: phone, message, channel: 'generic' });
}

async function notifyAdminOfPickupRequest(project, request) {
  // Fetch super_admin and operations admin phones to notify
  const supabase = require('../config/database');
  const { data: admins } = await supabase
    .from('admin_users')
    .select('phone, email')
    .in('role', ['super_admin', 'operations'])
    .eq('is_active', true)
    .limit(5);

  if (!admins || admins.length === 0) return;

  const recyclerLabel = request?.preferred_recycler || 'SolNuv to decide';
  const message = `SolNuv Admin: New pickup request for project "${project?.name || 'N/A'}" (${request?.requester_company_name || ''}). Preferred recycler: ${recyclerLabel}. Review at solnuv.com/admin.`;

  const results = await Promise.allSettled(
    admins.filter(a => a.phone).map(a => sendSms({ to: a.phone, message, channel: 'generic' }))
  );

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    logger.warn('Some admin SMS notifications failed', {
      count: failures.length,
      errors: failures.map(f => f.reason?.message || 'Unknown error'),
    });
  }
}

async function sendDecommissionApproved(user, project) {
  const phone = user?.phone;
  if (!phone) return { success: false, reason: 'User phone missing' };

  const message = `SolNuv: Your pickup request for "${project?.name || 'your project'}" has been approved. You may now mark the project as decommissioned from your dashboard.`;
  return sendSms({ to: phone, message, channel: 'generic' });
}

async function notifyAdminsOfVerificationRequest(user, type) {
  const userType = type === 'company' ? 'company' : 'solo';
  const userName = user?.first_name || 'Unknown';
  const userEmail = user?.email || '';
  
  logger.info('New verification request', {
    user_id: user?.id,
    user_name: userName,
    user_email: userEmail,
    user_type: userType,
  });
}

async function notifyUserOfVerificationStatus(user, status, reason = null) {
  const phone = user?.phone;
  if (!phone) return { success: false, reason: 'User phone missing' };

  let message;
  if (status === 'verified') {
    message = `SolNuv: Your account has been verified! You now have full access to all platform tools. Welcome aboard!`;
  } else if (status === 'rejected') {
    message = `SolNuv: Your verification was rejected. Reason: ${reason || 'Please contact support'}. You can re-request verification from your settings.`;
  } else {
    return { success: true };
  }

  return sendSms({ to: phone, message, channel: 'generic' });
}

module.exports = {
  sendWelcomeNotification,
  sendPaymentConfirmation,
  sendRecoveryConfirmation,
  notifyAdminOfPickupRequest,
  sendDecommissionApproved,
  notifyAdminsOfVerificationRequest,
  notifyUserOfVerificationStatus,
};
