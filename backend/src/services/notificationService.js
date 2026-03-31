const { sendSms } = require('./termiiService');

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

module.exports = {
  sendWelcomeNotification,
  sendPaymentConfirmation,
  sendRecoveryConfirmation,
};
