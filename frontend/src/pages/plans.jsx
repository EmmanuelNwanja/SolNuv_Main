import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { paymentsAPI } from '../services/api';
import { getDashboardLayout } from '../components/Layout';
import { LoadingSpinner } from '../components/ui/index';
import { RiCheckLine, RiArrowRightLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function Plans() {
  const { profile, plan: currentPlan, isPro } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);

  useEffect(() => {
    paymentsAPI.getPlans()
      .then(r => setPlans(r.data.data?.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(planId) {
    if (planId === 'free') return;
    if (planId === 'enterprise') { window.location.href = 'mailto:sales@solnuv.com'; return; }
    if (planId === currentPlan) { toast('You are already on this plan!'); return; }
    setUpgrading(planId);
    try {
      const { data } = await paymentsAPI.initialize({ plan: planId });
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

      <div className="page-header text-center">
        <h1 className="font-display font-bold text-3xl text-forest-900">Choose Your Plan</h1>
        <p className="text-slate-500 mt-2">Upgrade to unlock NESREA compliance reports and team features</p>
        <p className="text-xs text-slate-400 mt-1">All prices in Nigerian Naira (₦). Cancel anytime.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {plans.map(plan => (
            <div key={plan.id} className={`rounded-2xl overflow-hidden flex flex-col ${plan.popular ? 'ring-2 ring-forest-900 shadow-xl' : 'border border-slate-200 bg-white'} ${plan.id === currentPlan ? 'ring-2 ring-emerald-500' : ''}`}>
              {plan.popular && !plan.id === currentPlan && (
                <div className="bg-forest-900 text-center py-2 text-xs font-bold text-amber-400">MOST POPULAR</div>
              )}
              {plan.id === currentPlan && (
                <div className="bg-emerald-500 text-center py-2 text-xs font-bold text-white">YOUR CURRENT PLAN</div>
              )}
              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-display font-bold text-forest-900 text-xl mb-1">{plan.name}</h3>
                <div className="flex items-end gap-1 mb-5">
                  <span className="font-display font-bold text-3xl text-forest-900">{plan.price_display?.split('/')[0] || plan.price_display}</span>
                  {plan.price_ngn !== null && <span className="text-slate-400 text-sm pb-1">/month</span>}
                </div>
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
        <p>Payments are processed securely by Paystack. Subscriptions renew monthly.</p>
        <p className="mt-1">Questions? <a href="mailto:support@solnuv.com" className="text-forest-900 hover:underline">support@solnuv.com</a></p>
      </div>
    </>
  );
}

Plans.getLayout = getDashboardLayout;
