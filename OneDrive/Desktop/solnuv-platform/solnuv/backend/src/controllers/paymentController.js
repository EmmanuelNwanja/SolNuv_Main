/**
 * SolNuv Payments Controller
 * Paystack integration for Nigerian payments
 */

const axios = require('axios');
const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { sendPaymentConfirmation } = require('../services/emailService');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

const PLAN_PRICES = {
  pro: 1000000,    // ₦10,000 in kobo (Paystack uses kobo)
  elite: 2500000,  // ₦25,000 in kobo
};

const PLAN_LIMITS = {
  free: 1,
  pro: 2,
  elite: 5,
  enterprise: 15,
};

/**
 * POST /api/payments/initialize
 * Initialize Paystack payment
 */
exports.initializePayment = async (req, res) => {
  try {
    const { plan } = req.body;

    if (!['pro', 'elite'].includes(plan)) {
      return sendError(res, 'Invalid plan. Choose pro or elite', 400);
    }

    const amount = PLAN_PRICES[plan];
    const email = req.user.email;

    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount,
        currency: 'NGN',
        callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
        metadata: {
          user_id: req.user.id,
          plan,
          company_id: req.user.company_id || null,
        },
        channels: ['card', 'bank', 'ussd', 'bank_transfer'],
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return sendSuccess(res, {
      authorization_url: response.data.data.authorization_url,
      access_code: response.data.data.access_code,
      reference: response.data.data.reference,
    });
  } catch (error) {
    console.error('Payment init error:', error.response?.data || error.message);
    return sendError(res, 'Failed to initialize payment', 500);
  }
};

/**
 * GET /api/payments/verify/:reference
 * Verify payment after redirect
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    const { status, metadata, amount } = response.data.data;

    if (status !== 'success') {
      return sendError(res, 'Payment was not successful', 400);
    }

    const { user_id, plan, company_id } = metadata;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription

    // Update company subscription
    if (company_id) {
      await supabase.from('companies').update({
        subscription_plan: plan,
        subscription_expires_at: expiresAt.toISOString(),
        max_team_members: PLAN_LIMITS[plan],
        paystack_customer_id: response.data.data.customer?.customer_code,
      }).eq('id', company_id);
    }

    // Send confirmation email
    const { data: user } = await supabase.from('users').select('*').eq('id', user_id).single();
    if (user) {
      await sendPaymentConfirmation(user, plan.toUpperCase(), amount / 100);

      // Add notification
      await supabase.from('notifications').insert({
        user_id,
        type: 'payment',
        title: `${plan.toUpperCase()} Plan Activated!`,
        message: `Your subscription has been activated. You now have access to all ${plan} features.`,
        data: { plan, amount: amount / 100 },
      });
    }

    return sendSuccess(res, {
      plan,
      expires_at: expiresAt.toISOString(),
      message: `${plan.toUpperCase()} subscription activated successfully!`,
    });
  } catch (error) {
    console.error('Payment verify error:', error.response?.data || error.message);
    return sendError(res, 'Payment verification failed', 500);
  }
};

/**
 * POST /api/payments/webhook
 * Paystack webhook handler
 */
exports.handleWebhook = async (req, res) => {
  try {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      const { metadata, amount } = data;
      if (metadata?.plan && metadata?.company_id) {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await supabase.from('companies').update({
          subscription_plan: metadata.plan,
          subscription_expires_at: expiresAt.toISOString(),
          max_team_members: PLAN_LIMITS[metadata.plan],
        }).eq('id', metadata.company_id);
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).send('Webhook error');
  }
};

/**
 * GET /api/payments/plans
 * Return pricing plans
 */
exports.getPlans = async (req, res) => {
  return sendSuccess(res, {
    plans: [
      {
        id: 'free',
        name: 'Free',
        price_ngn: 0,
        price_display: '₦0/mo',
        features: [
          'Unlimited project logging',
          'West African decommission predictions',
          'Silver value calculator',
          'Email decommission alerts',
          '1 user / 1 device',
        ],
        limits: { team_members: 1 },
        cta: 'Get Started Free',
      },
      {
        id: 'pro',
        name: 'Pro',
        price_ngn: 10000,
        price_display: '₦10,000/mo',
        popular: true,
        features: [
          'Everything in Free',
          'NESREA EPR Compliance PDF Reports',
          'Cradle-to-Grave Certificates',
          'Excel data export',
          'QR code per project',
          'Recovery request management',
          'Team access (up to 2 users)',
          'Standard support',
        ],
        limits: { team_members: 2 },
        cta: 'Start Pro',
      },
      {
        id: 'elite',
        name: 'Elite',
        price_ngn: 25000,
        price_display: '₦25,000/mo',
        features: [
          'Everything in Pro',
          'Auto-send reports to NESREA',
          'Team access (up to 5 users)',
          'Priority support',
          'Leaderboard featured badge',
        ],
        limits: { team_members: 5 },
        cta: 'Go Elite',
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price_ngn: null,
        price_display: 'Contact Us',
        features: [
          'Everything in Elite',
          'Custom integrations',
          'Team access (up to 15+ users)',
          'Dedicated account manager',
          'Custom reporting',
          'Top priority support',
        ],
        limits: { team_members: 15 },
        cta: 'Contact Sales',
      },
    ],
  });
};
