import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { paymentsAPI } from '../services/api';
import { getDashboardLayout } from '../components/Layout';
import { LoadingSpinner } from '../components/ui/index';
import { MotionSection } from '../components/PageMotion';
import { RiCheckLine, RiArrowRightLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function Plans() {
  const { profile, plan: currentPlan, isPro } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [promoInput, setPromoInput] = useState('');
  const [promoPlanForCheck, setPromoPlanForCheck] = useState('pro');
  const [promoResult, setPromoResult] = useState(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  useEffect(() => {
    paymentsAPI.getPlans()
      .then(r => setPlans(r.data.data?.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPromoResult(null);
  }, [billingInterval, promoPlanForCheck]);

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
    if (planId === 'free') return;
    if (planId === 'enterprise') { window.location.href = 'mailto:sales@solnuv.com'; return; }
    if (planId === currentPlan) { toast('You are already on this plan!'); return; }
    setUpgrading(planId);
    try {
      const { data } = await paymentsAPI.initialize({
        plan: planId,
        billing_interval: billingInterval,
        promo_code: promoResult?.plan_id === planId ? promoResult?.promo_code : null,
      });
      if (data.data?.authorization_url) {
        window.location.href = data.data.authorization_url;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initialize payment');
    } finally { setUpgrading(null); }
  }

  return (
    <>
      <Head><title>Plans & Pricing — SolNuv</title></Head>

      <MotionSection className="mb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-forest-900 to-emerald-800 p-6 sm:p-8 text-white text-center">
          <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="relative">
            <h1 className="font-display font-bold text-3xl sm:text-4xl">Choose Your Plan</h1>
            <p className="text-white/75 mt-2">Upgrade to unlock NESREA compliance reports, advanced analytics, and team workflows</p>
            <p className="text-xs text-white/60 mt-1">All prices in Nigerian Naira. Annual billing includes 10% discount on every paid plan.</p>

        <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setBillingInterval('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${billingInterval === 'monthly' ? 'bg-white text-forest-900 shadow-sm' : 'text-slate-500'}`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${billingInterval === 'annual' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
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
            {promoResult.promo_code} applied: pay N{Number(promoResult.payable_amount_ngn || 0).toLocaleString('en-NG')} instead of N{Number(promoResult.original_amount_ngn || 0).toLocaleString('en-NG')}
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
                  <span className="font-display font-bold text-3xl text-forest-900">
                    {billingInterval === 'annual'
                      ? `N${Number(plan.annual_price_ngn || 0).toLocaleString('en-NG')}`
                      : `N${Number(plan.monthly_price_ngn || 0).toLocaleString('en-NG')}`}
                  </span>
                  {plan.id !== 'free' && <span className="text-slate-400 text-sm pb-1">/{billingInterval === 'annual' ? 'year' : 'month'}</span>}
                </div>
                {billingInterval === 'annual' && plan.annual_savings_ngn > 0 && (
                  <p className="text-xs text-emerald-600 -mt-3 mb-4">Save N{Number(plan.annual_savings_ngn).toLocaleString('en-NG')} annually</p>
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
                      : plan.id === 'free'
                        ? 'Free Forever'
                        : <>{plan.cta} <RiArrowRightLine /></>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-10 text-sm text-slate-400">
        <p>Payments are processed securely by Paystack. Monthly and annual subscriptions support auto-renewal.</p>
        <p className="mt-1">Questions? <a href="mailto:support@solnuv.com" className="text-forest-900 hover:underline">support@solnuv.com</a></p>
      </div>
    </>
  );
}

Plans.getLayout = getDashboardLayout;
