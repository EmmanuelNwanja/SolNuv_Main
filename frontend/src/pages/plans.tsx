import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { paymentsAPI } from '../services/api';
import { getDashboardLayout } from '../components/Layout';
import { LoadingSpinner } from '../components/ui/index';
import { MotionSection } from '../components/PageMotion';
import { RiCheckLine, RiArrowRightLine, RiBankLine, RiBankCardLine, RiUpload2Line, RiCloseLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function Plans() {
  const { profile, plan: currentPlan, isPro } = useAuth();
  const router = useRouter();
  const isWelcome = router.query.welcome === '1';
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [promoInput, setPromoInput] = useState('');
  const [promoPlanForCheck, setPromoPlanForCheck] = useState('basic');
  const [promoResult, setPromoResult] = useState(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  // Payment method modal
  const [pendingPlan, setPendingPlan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null); // null | 'bank_transfer' | 'paystack'
  const [bankSettings, setBankSettings] = useState(null);
  const [bankSettingsLoading, setBankSettingsLoading] = useState(false);
  const [transferRef, setTransferRef] = useState('');
  const [transferFile, setTransferFile] = useState(null);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [transferDone, setTransferDone] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    paymentsAPI.getPlans()
      .then(r => setPlans((r.data.data?.plans || []).filter(p => p.id !== 'free')))
      .catch((err) => {
        console.error('Failed to load plans:', err);
        toast.error('Failed to load pricing plans');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPromoResult(null);
  }, [billingInterval, promoPlanForCheck]);

  // Fetch bank settings when user picks bank_transfer
  useEffect(() => {
    if (paymentMethod !== 'bank_transfer') return;
    setBankSettingsLoading(true);
    paymentsAPI.getBankTransferSettings()
      .then(r => setBankSettings(r.data.data || null))
      .catch(() => setBankSettings(null))
      .finally(() => setBankSettingsLoading(false));
  }, [paymentMethod]);

  function openPaymentModal(planId) {
    if (planId === 'enterprise') { window.location.href = '/contact'; return; }
    if (planId === 'free') return; // free tier is always available — nothing to pay for
    if (planId === currentPlan) { toast('You are already on this plan!'); return; }
    setPendingPlan(planId);
    setPaymentMethod(null);
    setTransferRef('');
    setTransferFile(null);
    setTransferDone(false);
    setShowPaymentModal(true);
  }

  function closePaymentModal() {
    setShowPaymentModal(false);
    setPendingPlan(null);
    setPaymentMethod(null);
    setUpgrading(null);
  }

  function getPendingAmount() {
    const plan = plans.find(p => p.id === pendingPlan);
    if (!plan) return 0;
    if (promoResult?.plan_id === pendingPlan) return promoResult.payable_amount_ngn || 0;
    return billingInterval === 'annual' ? plan.annual_price_ngn : plan.monthly_price_ngn;
  }

  async function handlePaystackUpgrade() {
    if (!pendingPlan) return;
    setUpgrading(pendingPlan);
    try {
      const { data } = await paymentsAPI.initialize({
        plan: pendingPlan,
        billing_interval: billingInterval,
        promo_code: promoResult?.plan_id === pendingPlan ? promoResult?.promo_code : null,
      });
      if (data.data?.authorization_url) {
        window.location.href = data.data.authorization_url;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initialize payment');
    } finally { setUpgrading(null); }
  }

  async function handleBankTransferSubmit() {
    if (!transferRef.trim()) { toast.error('Please enter your bank transaction reference'); return; }
    const amount = getPendingAmount();
    if (!amount) { toast.error('Could not determine plan amount'); return; }

    setSubmittingTransfer(true);
    try {
      const formData = new FormData();
      formData.append('plan_id', pendingPlan);
      formData.append('billing_interval', billingInterval);
      formData.append('amount_ngn', String(amount));
      formData.append('reference_note', transferRef.trim());
      if (transferFile) {
        formData.append('receipt', transferFile, transferFile.name);
      }

      await paymentsAPI.submitBankTransfer(formData);
      setTransferDone(true);
      toast.success('Submission received! An admin will verify and activate your plan within 24 hours.');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setSubmittingTransfer(false);
    }
  }

  async function applyPromo(planId) {
    if (!promoInput.trim()) {
      setPromoResult(null);
      return;
    }

    setCheckingPromo(true);
    try {
      const { data } = await paymentsAPI.validatePromo({
        promo_code: promoInput.trim().toUpperCase(),
        plan: planId,
        billing_interval: billingInterval,
      });
      setPromoResult({ ...data.data, plan_id: planId });
      toast.success('Promo code applied');
    } catch (err) {
      setPromoResult(null);
      toast.error(err.response?.data?.message || 'Promo code is not valid for this plan');
    } finally {
      setCheckingPromo(false);
    }
  }

  async function handleUpgrade(planId) {
    openPaymentModal(planId);
  }

  return (
    <>
      <Head><title>Plans & Pricing — SolNuv | Solar Design, Modelling & Compliance</title></Head>

      <MotionSection className="mb-6">
        {isWelcome && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-start gap-3">
            <span className="text-emerald-500 text-xl mt-0.5">🎉</span>
            <div>
              <p className="font-semibold text-emerald-900 text-sm">Account setup complete — choose a plan to get started</p>
              <p className="text-emerald-700 text-xs mt-0.5">Pick the plan that fits your workflow. You can upgrade at any time.</p>
            </div>
          </div>
        )}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-forest-900 to-emerald-800 p-6 sm:p-8 text-white text-center">
          <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="relative">
            <h1 className="marketing-hero-dark-title">Choose Your Plan</h1>
            <p className="text-white/75 mt-2 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">Unlock solar+BESS design, 25-year financial modelling, professional reports, NESREA compliance, and AI agents</p>
            <p className="text-xs text-white/60 mt-1">All prices in Nigerian Naira. No FX surprises. Annual billing includes 10% discount on every paid plan.</p>

        <div className="mt-6 flex w-full max-w-md mx-auto sm:max-w-none sm:inline-flex rounded-xl bg-slate-100 p-1 gap-1">
          <button
            type="button"
            onClick={() => setBillingInterval('monthly')}
            className={`flex-1 min-h-[2.75rem] px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold ${billingInterval === 'monthly' ? 'bg-white text-forest-900 shadow-sm' : 'text-slate-500'}`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval('annual')}
            className={`flex-1 min-h-[2.75rem] px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold leading-snug ${billingInterval === 'annual' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
          >
            Annual Billing (Save 10%)
          </button>
        </div>

        <div className="max-w-md mx-auto mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={promoPlanForCheck}
            onChange={(e) => setPromoPlanForCheck(e.target.value)}
            className="input sm:col-span-1"
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <input
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            placeholder="Promo code (optional)"
            className="input sm:col-span-1"
          />
          <button
            type="button"
            onClick={() => applyPromo(promoPlanForCheck)}
            disabled={checkingPromo}
            className="btn-outline whitespace-nowrap sm:col-span-1"
          >
            {checkingPromo ? 'Checking...' : 'Apply'}
          </button>
        </div>

        {promoResult && (
          <p className="text-xs text-emerald-200 mt-2">
            {promoResult.promo_code} applied: pay ₦{Number(promoResult.payable_amount_ngn || 0).toLocaleString('en-NG')} instead of ₦{Number(promoResult.original_amount_ngn || 0).toLocaleString('en-NG')}
          </p>
        )}
          </div>
        </div>
      </MotionSection>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {plans.map(plan => (
            <div key={plan.id} className={`rounded-2xl overflow-hidden flex flex-col ${plan.popular ? 'ring-2 ring-forest-900 shadow-xl' : 'border border-slate-200 bg-white'} ${plan.id === currentPlan ? 'ring-2 ring-emerald-500' : ''}`}>
              {plan.popular && plan.id !== currentPlan && (
                <div className="bg-forest-900 text-center py-2 text-xs font-bold text-amber-400">MOST POPULAR</div>
              )}
              {plan.id === currentPlan && (
                <div className="bg-emerald-500 text-center py-2 text-xs font-bold text-white">YOUR CURRENT PLAN</div>
              )}
              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-display font-bold text-forest-900 text-xl mb-1">{plan.name}</h3>
                <div className="flex items-end gap-1 mb-5">
                  <span className="font-display font-bold text-forest-900 plan-price-display">
                    {billingInterval === 'annual'
                      ? `₦${Number(plan.annual_price_ngn || 0).toLocaleString('en-NG')}`
                      : `₦${Number(plan.monthly_price_ngn || 0).toLocaleString('en-NG')}`}
                  </span>
                  {plan.monthly_price_ngn > 0 && <span className="text-slate-400 text-sm pb-1">/{billingInterval === 'annual' ? 'year' : 'month'}</span>}
                </div>
                {billingInterval === 'annual' && plan.annual_savings_ngn > 0 && (
                  <p className="text-xs text-emerald-600 -mt-3 mb-4">Save ₦{Number(plan.annual_savings_ngn).toLocaleString('en-NG')} annually</p>
                )}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features?.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <RiCheckLine className="text-emerald-500 flex-shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={!!upgrading || plan.id === currentPlan}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${plan.id === currentPlan ? 'bg-emerald-50 text-emerald-700 cursor-default' : plan.popular ? 'btn-primary' : 'btn-outline'} disabled:opacity-60`}
                >
                  {upgrading === plan.id
                    ? <LoadingSpinner size="sm" />
                    : plan.id === currentPlan
                      ? '✓ Current Plan'
                      : <>{plan.cta} <RiArrowRightLine /></>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-10 text-sm text-slate-400">
        <p>Payments are processed securely. Available payment methods are shown at checkout based on current platform availability.</p>
        <p className="mt-1">All plans include core design and project workflows. Need help choosing? <a href="mailto:support@solnuv.com" className="text-forest-900 hover:underline">support@solnuv.com</a></p>
      </div>

      {/* ── Payment Method Modal ─────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <button
              onClick={closePaymentModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Close"
            >
              <RiCloseLine size={22} />
            </button>

            {/* Step 1 — choose method */}
            {!paymentMethod && (
              <div className="p-6">
                <h2 className="font-display font-bold text-xl text-forest-900 mb-1">Choose Payment Method</h2>
                <p className="text-sm text-slate-500 mb-6">Select how you'd like to pay for the <span className="font-semibold capitalize">{pendingPlan}</span> plan.</p>
                <div className="space-y-3">
                  <button
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className="w-full flex items-start gap-4 border-2 border-slate-200 hover:border-forest-900 rounded-xl p-4 text-left transition-all group"
                  >
                    <span className="mt-0.5 w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100">
                      <RiBankLine className="text-emerald-600" size={20} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">Direct Bank Transfer</span>
                        <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Recommended</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Transfer directly to our bank account and upload your receipt. Plan activates within 24 hours of admin review.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/payment-coming-soon')}
                    className="w-full flex items-start gap-4 border-2 border-slate-200 hover:border-slate-300 rounded-xl p-4 text-left transition-all group opacity-75 cursor-pointer"
                  >
                    <span className="mt-0.5 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <RiBankCardLine className="text-blue-400" size={20} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-600">Paystack</span>
                        <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">Coming Soon</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Online card and USSD payment via Paystack. Currently unavailable — use Direct Bank Transfer.</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — bank transfer form */}
            {paymentMethod === 'bank_transfer' && !transferDone && (
              <div className="p-6">
                <button onClick={() => setPaymentMethod(null)} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1">
                  ← Back
                </button>
                <h2 className="font-display font-bold text-xl text-forest-900 mb-1">Bank Transfer Details</h2>
                <p className="text-sm text-slate-500 mb-5">
                  Transfer <span className="font-semibold text-slate-800">₦{Number(getPendingAmount()).toLocaleString('en-NG')}</span> to the account below, then upload your receipt.
                </p>

                {bankSettingsLoading && <div className="flex justify-center py-6"><LoadingSpinner size="md" /></div>}

                {!bankSettingsLoading && bankSettings?.is_active === false && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-5">Direct bank transfer is temporarily unavailable. Please use Paystack or contact support@solnuv.com.</p>
                )}

                {!bankSettingsLoading && bankSettings?.is_active !== false && bankSettings && (
                  <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2 text-sm border border-slate-200">
                    {bankSettings.bank_name && (
                      <div className="flex justify-between"><span className="text-slate-500">Bank</span><span className="font-semibold text-slate-800">{bankSettings.bank_name}</span></div>
                    )}
                    {bankSettings.account_number && (
                      <div className="flex justify-between"><span className="text-slate-500">Account No.</span><span className="font-mono font-semibold text-slate-800 text-base tracking-widest">{bankSettings.account_number}</span></div>
                    )}
                    {bankSettings.account_name && (
                      <div className="flex justify-between"><span className="text-slate-500">Account Name</span><span className="font-semibold text-slate-800">{bankSettings.account_name}</span></div>
                    )}
                    {bankSettings.additional_instructions && (
                      <p className="text-slate-500 pt-2 border-t border-slate-200 text-xs">{bankSettings.additional_instructions}</p>
                    )}
                  </div>
                )}

                {!bankSettingsLoading && !bankSettings && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-5">Bank account details are not configured yet. Please contact support@solnuv.com.</p>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Reference / Narration <span className="text-red-500">*</span></label>
                    <input
                      value={transferRef}
                      onChange={e => setTransferRef(e.target.value)}
                      placeholder="e.g. Bank teller ID or transfer narration"
                      className="input w-full"
                    />
                    <p className="text-xs text-slate-400 mt-1">Enter the reference or narration from your bank receipt to help us match the payment.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Receipt <span className="text-slate-400 font-normal">(optional)</span></label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer hover:border-forest-900 transition-colors"
                    >
                      <RiUpload2Line className="text-slate-400" size={24} />
                      {transferFile
                        ? <span className="text-sm text-slate-700 font-medium">{transferFile.name}</span>
                        : <><span className="text-sm text-slate-500">Click to upload receipt</span><span className="text-xs text-slate-400">PNG, JPG, or PDF — max 5 MB</span></>}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f && f.size > 5 * 1024 * 1024) { toast.error('File must be under 5 MB'); e.target.value = ''; return; }
                        setTransferFile(f || null);
                      }}
                    />
                  </div>

                  <button
                    onClick={handleBankTransferSubmit}
                    disabled={submittingTransfer || bankSettings?.is_active === false}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submittingTransfer ? <><LoadingSpinner size="sm" /> Submitting...</> : 'Submit for Verification'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — success */}
            {paymentMethod === 'bank_transfer' && transferDone && (
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <RiCheckLine className="text-emerald-600" size={28} />
                </div>
                <h2 className="font-display font-bold text-xl text-forest-900 mb-2">Submission Received!</h2>
                <p className="text-sm text-slate-600 mb-6">Your payment proof has been submitted. An admin will review and activate your <span className="font-semibold capitalize">{pendingPlan}</span> plan within 24 hours.</p>
                <button onClick={closePaymentModal} className="btn-primary w-full py-3">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

Plans.getLayout = getDashboardLayout;
