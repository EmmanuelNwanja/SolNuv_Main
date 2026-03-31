/**
 * SolNuv Payments Controller
 * Paystack integration for Nigerian payments
 */

const axios = require('axios');
const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { sendPaymentConfirmation } = require('../services/emailService');
const { logPlatformActivity } = require('../services/auditService');
const {
  BILLING_INTERVALS,
  PLAN_LIMITS,
  PAID_PLAN_IDS,
  getPlanPrice,
  getPlanDurationMonths,
  getPlanCatalogForClient,
} = require('../services/billingService');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

function asKobo(nairaAmount) {
  return Math.round(Number(nairaAmount || 0) * 100);
}

async function ensureCompanyForBilling(user) {
  if (user.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', user.company_id)
      .single();
    return company;
  }

  const generatedName = user.brand_name || `${user.first_name || 'SolNuv'} Workspace`;
  const { data: company, error } = await supabase
    .from('companies')
    .insert({
      name: generatedName,
      email: user.email,
      user_type: user.user_type || 'installer',
      business_type: user.business_type || 'solo',
      subscription_plan: 'free',
      max_team_members: PLAN_LIMITS.free,
    })
    .select('*')
    .single();

  if (error) throw error;

  await supabase.from('users').update({ company_id: company.id }).eq('id', user.id);
  return company;
}

async function fetchPaystackPlanCode(plan, billingInterval) {
  const planKey = `${plan}_${billingInterval}`;
  const { data } = await supabase
    .from('paystack_plan_catalog')
    .select('paystack_plan_code')
    .eq('plan_key', planKey)
    .eq('active', true)
    .single();

  return data?.paystack_plan_code || null;
}

async function validatePromoCode({ promoCode, plan, billingInterval, baseAmountNgn }) {
  if (!promoCode) {
    return {
      valid: true,
      promo: null,
      discountAmountNgn: 0,
      finalAmountNgn: baseAmountNgn,
    };
  }

  const normalizedCode = String(promoCode || '').trim().toUpperCase();
  const nowIso = new Date().toISOString();

  const { data: promo } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', normalizedCode)
    .eq('active', true)
    .single();

  if (!promo) {
    return { valid: false, message: 'Promo code is invalid or inactive' };
  }

  if (promo.starts_at && new Date(promo.starts_at) > new Date()) {
    return { valid: false, message: 'Promo code is not active yet' };
  }
  if (promo.ends_at && new Date(promo.ends_at) < new Date()) {
    return { valid: false, message: 'Promo code has expired' };
  }
  if (promo.max_redemptions && Number(promo.redeemed_count || 0) >= Number(promo.max_redemptions)) {
    return { valid: false, message: 'Promo code redemption limit reached' };
  }

  const allowedPlans = promo.applies_to_plans || [];
  if (allowedPlans.length > 0 && !allowedPlans.includes(plan)) {
    return { valid: false, message: `Promo code is not available for ${plan.toUpperCase()} plan` };
  }

  const allowedIntervals = promo.applies_to_intervals || [];
  if (allowedIntervals.length > 0 && !allowedIntervals.includes(billingInterval)) {
    return { valid: false, message: `Promo code is not available for ${billingInterval} billing` };
  }

  let discountAmountNgn = 0;
  if (promo.discount_type === 'percent') {
    discountAmountNgn = (baseAmountNgn * Number(promo.discount_value || 0)) / 100;
  } else {
    discountAmountNgn = Number(promo.discount_value || 0);
  }

  discountAmountNgn = Math.max(0, Math.min(baseAmountNgn, discountAmountNgn));
  const finalAmountNgn = Math.max(0, baseAmountNgn - discountAmountNgn);

  return {
    valid: true,
    promo,
    checkedAt: nowIso,
    discountAmountNgn,
    finalAmountNgn,
  };
}

async function activateSubscription({
  user,
  company,
  plan,
  billingInterval,
  paidAmountNgn,
  originalAmountNgn,
  discountAmountNgn,
  promo,
  reference,
  paystackPayload,
  paymentStatus,
}) {
  const durationMonths = getPlanDurationMonths(billingInterval);
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  await supabase
    .from('companies')
    .update({
      subscription_plan: plan,
      subscription_interval: billingInterval,
      subscription_started_at: now.toISOString(),
      subscription_expires_at: expiresAt.toISOString(),
      subscription_auto_renew: true,
      max_team_members: PLAN_LIMITS[plan],
      paystack_customer_id: paystackPayload?.customer?.customer_code || company.paystack_customer_id,
      paystack_subscription_code: paystackPayload?.subscription?.subscription_code || company.paystack_subscription_code,
      paystack_subscription_email_token: paystackPayload?.subscription?.email_token || company.paystack_subscription_email_token,
      paystack_plan_code: paystackPayload?.plan_object?.plan_code || company.paystack_plan_code,
    })
    .eq('id', company.id);

  await supabase.from('subscription_transactions').upsert({
    user_id: user.id,
    company_id: company.id,
    plan,
    billing_interval: billingInterval,
    amount_ngn: paidAmountNgn,
    original_amount_ngn: originalAmountNgn,
    discount_amount_ngn: discountAmountNgn,
    promo_code: promo?.code || null,
    paystack_reference: reference,
    paystack_status: paymentStatus,
    paystack_customer_code: paystackPayload?.customer?.customer_code || null,
    paystack_subscription_code: paystackPayload?.subscription?.subscription_code || null,
    paid_at: paystackPayload?.paid_at || now.toISOString(),
  }, { onConflict: 'paystack_reference' });

  if (promo?.id) {
    const { data: existingRedemption } = await supabase
      .from('promo_redemptions')
      .select('id')
      .eq('promo_code_id', promo.id)
      .eq('transaction_reference', reference)
      .maybeSingle();

    if (!existingRedemption) {
      await supabase.from('promo_redemptions').insert({
        promo_code_id: promo.id,
        user_id: user.id,
        company_id: company.id,
        transaction_reference: reference,
        discount_amount_ngn: discountAmountNgn,
      });

      await supabase
        .from('promo_codes')
        .update({ redeemed_count: Number(promo.redeemed_count || 0) + 1 })
        .eq('id', promo.id);
    }
  }

  await supabase.from('notifications').insert({
    user_id: user.id,
    type: 'payment',
    title: `${plan.toUpperCase()} ${billingInterval === 'annual' ? 'Annual' : 'Monthly'} Plan Activated`,
    message: `Your ${plan.toUpperCase()} ${billingInterval} subscription is active until ${expiresAt.toLocaleDateString('en-NG')}.`,
    data: {
      plan,
      billing_interval: billingInterval,
      amount_ngn: paidAmountNgn,
      reference,
      promo_code: promo?.code || null,
    },
  });

  await sendPaymentConfirmation(
    user,
    plan.toUpperCase(),
    paidAmountNgn,
    billingInterval
  );

  await logPlatformActivity({
    actorUserId: user.id,
    actorEmail: user.email,
    action: 'subscription.activated',
    resourceType: 'company',
    resourceId: company.id,
    details: {
      plan,
      billing_interval: billingInterval,
      amount_ngn: paidAmountNgn,
      reference,
      promo_code: promo?.code || null,
    },
  });

  return expiresAt;
}

/**
 * POST /api/payments/initialize
 * Initialize Paystack payment
 */
exports.initializePayment = async (req, res) => {
  try {
    const { plan, billing_interval = 'monthly', promo_code = null, auto_renew = true } = req.body;

    if (!PAID_PLAN_IDS.includes(plan)) {
      return sendError(res, 'Invalid plan. Choose pro, elite, or enterprise', 400);
    }
    if (!BILLING_INTERVALS.includes(billing_interval)) {
      return sendError(res, 'Invalid billing interval. Choose monthly or annual', 400);
    }

    const company = await ensureCompanyForBilling(req.user);

    const originalAmountNgn = getPlanPrice(plan, billing_interval);
    if (!originalAmountNgn) return sendError(res, 'Selected plan is not billable', 400);

    const promoValidation = await validatePromoCode({
      promoCode: promo_code,
      plan,
      billingInterval: billing_interval,
      baseAmountNgn: originalAmountNgn,
    });
    if (!promoValidation.valid) {
      return sendError(res, promoValidation.message, 400, { code: 'PROMO_INVALID' });
    }

    const payableAmountNgn = promoValidation.finalAmountNgn;
    const amount = asKobo(payableAmountNgn);
    const email = req.user.email;
    const planCode = auto_renew ? await fetchPaystackPlanCode(plan, billing_interval) : null;

    const payload = {
      email,
      amount,
      currency: 'NGN',
      callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
      metadata: {
        user_id: req.user.id,
        plan,
        billing_interval,
        company_id: company.id,
        original_amount_ngn: originalAmountNgn,
        payable_amount_ngn: payableAmountNgn,
        discount_amount_ngn: promoValidation.discountAmountNgn,
        promo_code: promoValidation.promo?.code || null,
        auto_renew: !!auto_renew,
      },
      channels: ['card', 'bank', 'ussd', 'bank_transfer'],
    };

    if (planCode && !promoValidation.promo) {
      payload.plan = planCode;
    }

    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      payload,
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
      amount_ngn: payableAmountNgn,
      original_amount_ngn: originalAmountNgn,
      discount_amount_ngn: promoValidation.discountAmountNgn,
      promo_code: promoValidation.promo?.code || null,
      billing_interval,
      auto_renew_enabled: !!(planCode && !promoValidation.promo),
      message: promoValidation.promo
        ? 'Promo applied. Autorenew will start on next cycle after this discounted payment.'
        : 'Payment initialized with autorenew support.',
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

    const txData = response.data.data;
    const { status, metadata, amount } = txData;

    if (status !== 'success') {
      return sendError(res, 'Payment was not successful', 400);
    }

    const { user_id, plan, company_id, billing_interval = 'monthly', promo_code = null } = metadata || {};
    if (!user_id || !plan || !company_id) {
      return sendError(res, 'Payment metadata is incomplete', 400);
    }

    const { data: user } = await supabase.from('users').select('*').eq('id', user_id).single();
    const { data: company } = await supabase.from('companies').select('*').eq('id', company_id).single();
    if (!user || !company) return sendError(res, 'Account not found for payment verification', 404);

    const promoValidation = await validatePromoCode({
      promoCode: promo_code,
      plan,
      billingInterval: billing_interval,
      baseAmountNgn: getPlanPrice(plan, billing_interval),
    });

    const expiresAt = await activateSubscription({
      user,
      company,
      plan,
      billingInterval: billing_interval,
      paidAmountNgn: amount / 100,
      originalAmountNgn: Number(metadata?.original_amount_ngn || getPlanPrice(plan, billing_interval)),
      discountAmountNgn: Number(metadata?.discount_amount_ngn || promoValidation.discountAmountNgn || 0),
      promo: promoValidation.promo,
      reference,
      paystackPayload: txData,
      paymentStatus: status,
    });

    return sendSuccess(res, {
      plan,
      billing_interval,
      amount_ngn: amount / 100,
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
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const parsed = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf8'))
      : req.body;
    const { event, data } = parsed;

    if (event === 'charge.success') {
      const metadata = data?.metadata || {};
      if (metadata.plan && metadata.company_id && metadata.user_id) {
        const { data: user } = await supabase.from('users').select('*').eq('id', metadata.user_id).single();
        const { data: company } = await supabase.from('companies').select('*').eq('id', metadata.company_id).single();
        if (user && company) {
          const promoValidation = await validatePromoCode({
            promoCode: metadata.promo_code,
            plan: metadata.plan,
            billingInterval: metadata.billing_interval || 'monthly',
            baseAmountNgn: getPlanPrice(metadata.plan, metadata.billing_interval || 'monthly'),
          });

          await activateSubscription({
            user,
            company,
            plan: metadata.plan,
            billingInterval: metadata.billing_interval || 'monthly',
            paidAmountNgn: Number(data.amount || 0) / 100,
            originalAmountNgn: Number(metadata.original_amount_ngn || getPlanPrice(metadata.plan, metadata.billing_interval || 'monthly')),
            discountAmountNgn: Number(metadata.discount_amount_ngn || promoValidation.discountAmountNgn || 0),
            promo: promoValidation.promo,
            reference: data.reference,
            paystackPayload: data,
            paymentStatus: data.status,
          });
        }
      }
    }

    if (event === 'subscription.disable' || event === 'invoice.payment_failed') {
      const customerCode = data?.customer?.customer_code;
      if (customerCode) {
        await supabase
          .from('companies')
          .update({ subscription_auto_renew: false })
          .eq('paystack_customer_id', customerCode);
      }
    }

    if (event === 'subscription.create' || event === 'subscription.not_renew') {
      const customerCode = data?.customer?.customer_code;
      if (customerCode) {
        await supabase
          .from('companies')
          .update({
            paystack_subscription_code: data?.subscription_code || null,
            paystack_plan_code: data?.plan?.plan_code || null,
            subscription_auto_renew: event !== 'subscription.not_renew',
          })
          .eq('paystack_customer_id', customerCode);
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
  const plans = getPlanCatalogForClient();

  return sendSuccess(res, {
    plans,
    annual_discount_percent: 10,
    supported_billing_intervals: BILLING_INTERVALS,
    promo_supported: true,
    auto_renew_via_paystack_plans: true,
  });
};

/**
 * POST /api/payments/promo/validate
 */
exports.validatePromo = async (req, res) => {
  try {
    const { promo_code, plan, billing_interval = 'monthly' } = req.body;
    if (!promo_code || !plan) return sendError(res, 'promo_code and plan are required', 400);

    const baseAmountNgn = getPlanPrice(plan, billing_interval);
    if (!baseAmountNgn) return sendError(res, 'Invalid plan for promo validation', 400);

    const result = await validatePromoCode({
      promoCode: promo_code,
      plan,
      billingInterval: billing_interval,
      baseAmountNgn,
    });

    if (!result.valid) return sendError(res, result.message, 400, { code: 'PROMO_INVALID' });

    return sendSuccess(res, {
      valid: true,
      promo_code: result.promo?.code || null,
      original_amount_ngn: baseAmountNgn,
      discount_amount_ngn: result.discountAmountNgn,
      payable_amount_ngn: result.finalAmountNgn,
    });
  } catch (error) {
    return sendError(res, 'Failed to validate promo code', 500);
  }
};

/**
 * GET /api/payments/history
 */
exports.getSubscriptionHistory = async (req, res) => {
  try {
    const query = supabase
      .from('subscription_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (req.user.company_id) query.eq('company_id', req.user.company_id);
    else query.eq('user_id', req.user.id);

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data || []);
  } catch (error) {
    return sendError(res, 'Failed to fetch subscription history', 500);
  }
};
