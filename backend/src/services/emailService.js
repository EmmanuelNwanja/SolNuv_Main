/**
 * SolNuv Email Service - Powered by Brevo (formerly Sendinblue)
 * Handles all transactional emails
 */

const nodemailer = require('nodemailer');

// Brevo SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.BREVO_SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

const FROM = `"${process.env.EMAIL_FROM_NAME || 'SolNuv'}" <${process.env.EMAIL_FROM || 'noreply@solnuv.com'}>`;

// ==============================
// EMAIL TEMPLATES
// ==============================

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SolNuv</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #F8FAFC; color: #1E293B; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0D3B2E; padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { color: #F59E0B; font-size: 28px; margin: 0 0 4px; }
    .header p { color: rgba(255,255,255,0.75); font-size: 13px; margin: 0; }
    .body { background: #FFFFFF; padding: 40px; border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; }
    .footer { background: #F1F5F9; padding: 24px 40px; border-radius: 0 0 12px 12px; border: 1px solid #E2E8F0; text-align: center; }
    .footer p { color: #94A3B8; font-size: 12px; margin: 4px 0; }
    .btn { display: inline-block; background: #0D3B2E; color: #FFFFFF !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 20px 0; }
    .btn-amber { background: #F59E0B; color: #1E293B !important; }
    .highlight { background: #FFF7ED; border-left: 4px solid #F59E0B; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
    .stat-box { background: #0D3B2E; color: #FFFFFF; border-radius: 8px; padding: 20px; margin: 10px 0; text-align: center; }
    .stat-box .number { font-size: 32px; font-weight: 700; color: #F59E0B; }
    .stat-box .label { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 4px; }
    h2 { color: #0D3B2E; }
    p { line-height: 1.7; color: #334155; }
    .divider { border: none; border-top: 1px solid #E2E8F0; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SolNuv</h1>
      <p>Solar Waste Tracking, Recovery & Compliance</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>SolNuv Platform | <a href="https://solnuv.com" style="color: #0D3B2E;">solnuv.com</a></p>
      <p>Lagos, Nigeria | compliance@solnuv.com</p>
      <p style="margin-top: 12px;"><a href="https://solnuv.com/unsubscribe" style="color: #94A3B8;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
`;

// ==============================
// EMAIL SEND FUNCTIONS
// ==============================

async function sendWelcomeEmail(user) {
  const content = `
    <h2>Welcome to SolNuv, ${user.first_name}! 🌞</h2>
    <p>You've taken the first step toward responsible solar energy management in Nigeria. Your account is ready.</p>
    <div class="highlight">
      <strong>What you can do right now:</strong><br>
      ✅ Log your first solar installation project<br>
      ✅ See your silver recovery estimate<br>
      ✅ Get a West African climate-adjusted decommission date
    </div>
    <p style="text-align:center">
      <a href="https://solnuv.com/dashboard" class="btn">Go to Dashboard →</a>
    </p>
    <hr class="divider">
    <p style="font-size: 13px; color: #64748B;">
      On average, a 50-panel installation in Lagos contains approximately <strong>7 grams of recoverable silver</strong> worth about <strong>₦10,885</strong> at formal recycling rates — value that is currently being lost to informal scrap dealers.
    </p>
  `;
  return sendEmail(user.email, 'Welcome to SolNuv — Let\'s Track Your Solar Fleet 🌞', content);
}

async function sendDecommissionAlert(user, project, equipment) {
  const daysUntil = equipment.days_until_decommission || 0;
  const urgencyColor = daysUntil < 0 ? '#EF4444' : daysUntil < 180 ? '#F59E0B' : '#10B981';
  const urgencyLabel = daysUntil < 0 ? '⚠️ OVERDUE' : daysUntil < 180 ? '🔴 CRITICAL — Act Now' : '🟡 Coming Up';

  const content = `
    <h2>Decommission Alert: ${project.name}</h2>
    <div class="highlight" style="border-left-color: ${urgencyColor}">
      <strong style="color: ${urgencyColor}">${urgencyLabel}</strong><br>
      This installation is approaching its West African climate-adjusted end-of-life date.
    </div>
    <div class="stat-box">
      <div class="number">${Math.abs(daysUntil)}</div>
      <div class="label">${daysUntil < 0 ? 'Days Overdue' : 'Days Until Decommission'}</div>
    </div>
    <p><strong>Project:</strong> ${project.name}</p>
    <p><strong>Location:</strong> ${project.city}, ${project.state}</p>
    <p><strong>Estimated Decommission:</strong> ${new Date(project.estimated_decommission_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <p>Don't let these panels end up with informal scrap dealers. Request a formal recovery now to receive your silver value and generate your NESREA compliance certificate.</p>
    <p style="text-align:center">
      <a href="https://solnuv.com/projects/${project.id}/recovery" class="btn btn-amber">Request Recovery →</a>
    </p>
  `;
  return sendEmail(user.email, `⚠️ Decommission Alert: ${project.name} — Act Now`, content);
}

async function sendTeamInvitation(email, inviterName, companyName, inviteLink, role) {
  const content = `
    <h2>You've been invited to join ${companyName} on SolNuv</h2>
    <p>${inviterName} has invited you to join their solar compliance team as <strong>${role}</strong>.</p>
    <p>SolNuv helps solar professionals in Nigeria track installations, predict decommissioning, and generate NESREA EPR compliance reports automatically.</p>
    <div class="highlight">
      Your role: <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong><br>
      Organisation: <strong>${companyName}</strong>
    </div>
    <p style="text-align:center">
      <a href="${inviteLink}" class="btn">Accept Invitation →</a>
    </p>
    <p style="font-size: 12px; color: #64748B;">This invitation expires in 7 days. If you didn't expect this, you can safely ignore this email.</p>
  `;
  return sendEmail(email, `You're invited to join ${companyName} on SolNuv`, content);
}

async function sendReportReadyEmail(user, company, reportUrl) {
  const content = `
    <h2>Your NESREA Report is Ready, ${user.first_name}</h2>
    <p>Your EPR compliance report has been generated successfully and is ready for download or direct submission to NESREA.</p>
    <div class="highlight">
      <strong>Report includes:</strong><br>
      ✅ Cradle-to-Grave traceability for all listed projects<br>
      ✅ Silver recovery calculations per site<br>
      ✅ West African climate-adjusted decommission dates<br>
      ✅ Compliance declaration under 2024 Battery Regulations
    </div>
    <p style="text-align:center">
      <a href="${reportUrl}" class="btn">Download PDF Report →</a>
    </p>
    <p>You can also auto-send this report directly to NESREA from your dashboard.</p>
  `;
  return sendEmail(user.email, '✅ Your NESREA EPR Compliance Report is Ready', content);
}

async function sendPaymentConfirmation(user, plan, amount, billingInterval = 'monthly') {
  const intervalLabel = billingInterval === 'annual' ? 'Annual Subscription' : 'Monthly Subscription';
  const content = `
    <h2>Payment Confirmed — Welcome to ${plan} ✅</h2>
    <p>Hi ${user.first_name}, your subscription has been activated successfully.</p>
    <div class="stat-box">
      <div class="number">₦${Number(amount).toLocaleString('en-NG')}</div>
      <div class="label">${plan} Plan — ${intervalLabel}</div>
    </div>
    <p>Your new plan features are now active. Head to your dashboard to start generating NESREA compliance reports.</p>
    <p style="text-align:center">
      <a href="https://solnuv.com/dashboard" class="btn">Open Dashboard →</a>
    </p>
  `;
  return sendEmail(user.email, `✅ Payment Confirmed — SolNuv ${plan} Activated`, content);
}

async function sendRecoveryConfirmation(user, project, recoveryRequest) {
  const content = `
    <h2>Recovery Request Submitted</h2>
    <p>Hi ${user.first_name}, your formal recovery request for <strong>${project.name}</strong> has been submitted successfully.</p>
    <div class="highlight">
      <strong>Request ID:</strong> ${recoveryRequest.id.substring(0, 8).toUpperCase()}<br>
      <strong>Preferred Date:</strong> ${recoveryRequest.preferred_date ? new Date(recoveryRequest.preferred_date).toLocaleDateString('en-NG') : 'TBD'}<br>
      <strong>Status:</strong> Requested — Our team will contact you within 24 hours
    </div>
    <p>Our certified recycling partners will reach out to schedule pickup and confirm your estimated silver recovery value.</p>
    <p style="text-align:center">
      <a href="https://solnuv.com/projects/${project.id}" class="btn">Track Recovery Status →</a>
    </p>
  `;
  return sendEmail(user.email, `Recovery Request Submitted — ${project.name}`, content);
}

// ==============================
// CORE SEND FUNCTION
// ==============================
async function sendEmail(to, subject, htmlContent) {
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html: baseTemplate(htmlContent),
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error.message);
    return { success: false, error: error.message };
  }
}

// Send email with PDF attachment
async function sendEmailWithAttachment(to, subject, htmlContent, attachment) {
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html: baseTemplate(htmlContent),
      attachments: [attachment],
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email with attachment error:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendWelcomeEmail,
  sendDecommissionAlert,
  sendTeamInvitation,
  sendReportReadyEmail,
  sendPaymentConfirmation,
  sendRecoveryConfirmation,
  sendEmail,
  sendEmailWithAttachment,
};
