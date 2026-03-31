import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { RiSunLine, RiCheckLine, RiArrowRightLine, RiArrowLeftLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

export default function Onboarding() {
  const { session, loading, profileResolved, isOnboarded, isPlatformAdmin, refreshProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    user_type: 'installer',
    business_type: 'solo',
    brand_name: '',
    company_name: '',
    company_email: '',
    company_address: '',
    company_state: 'Lagos',
    company_city: '',
  });

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [session, loading, router]);

  // Platform admins never need onboarding — redirect to /admin immediately
  useEffect(() => {
    if (!loading && profileResolved && session && isPlatformAdmin) {
      router.replace('/admin');
    }
  }, [loading, profileResolved, session, isPlatformAdmin, router]);

  // Already onboarded regular users should not be on this page
  useEffect(() => {
    if (!loading && profileResolved && session && isOnboarded && !isPlatformAdmin) {
      router.replace('/dashboard');
    }
  }, [loading, profileResolved, session, isOnboarded, isPlatformAdmin, router]);

  // Only require phone verification for brand-new regular users (not yet onboarded)
  useEffect(() => {
    if (!session?.user) return;
    if (!profileResolved) return;
    if (isPlatformAdmin) return; // already handled above
    if (isOnboarded) return; // already handled above
    if (!session.user.user_metadata?.phone_verified) {
      router.replace('/verify-phone');
    }
  }, [session?.user, profileResolved, isOnboarded, isPlatformAdmin, router]);

  useEffect(() => {
    if (!session?.user) return;

    let pending = {};
    try {
      pending = JSON.parse(localStorage.getItem('solnuv_pending_onboarding') || '{}');
    } catch {
      pending = {};
    }

    setForm((prev) => ({
      ...prev,
      phone: prev.phone || pending.phone || session.user.user_metadata?.phone || '',
      business_type: prev.business_type || pending.business_type || session.user.user_metadata?.business_type || 'solo',
    }));
  }, [session?.user]);

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const isRegistered = form.business_type === 'registered';
  const totalSteps = isRegistered ? 3 : 2;

  async function handleSubmit() {
    if (!form.first_name) { toast.error('Please enter your first name'); return; }
    if (!form.phone) { toast.error('Phone number is required'); return; }
    if (isRegistered && !form.company_name) { toast.error('Company name is required'); return; }
    setSubmitting(true);
    try {
      await authAPI.saveProfile(form);
      localStorage.removeItem('solnuv_pending_onboarding');
      await refreshProfile();
      toast.success('Profile saved! Welcome to SolNuv 🌞');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save profile');
    } finally { setSubmitting(false); }
  }

  const stepLabels = ['Account Type', 'Your Details', isRegistered ? 'Company Details' : null].filter(Boolean);

  return (
    <>
      <Head><title>Setup Your Account — SolNuv</title></Head>
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-forest-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <RiSunLine className="text-amber-400 text-2xl" />
            </div>
            <h1 className="font-display font-bold text-forest-900 text-2xl">Let's set up your account</h1>
            <p className="text-slate-500 text-sm mt-1">Takes less than 2 minutes</p>
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 ${i + 1 === step ? 'text-forest-900' : i + 1 < step ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${i + 1 === step ? 'border-forest-900 bg-forest-900 text-white' : i + 1 < step ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
                    {i + 1 < step ? <RiCheckLine /> : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{label}</span>
                </div>
                {i < stepLabels.length - 1 && <div className="w-8 h-0.5 bg-slate-200" />}
              </div>
            ))}
          </div>

          <div className="card shadow-md">
            {/* STEP 1: Account type */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <p className="label">What best describes your role?</p>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {[
                      { value: 'installer', label: 'Installer / Engineer', emoji: '🔧' },
                      { value: 'epc', label: 'EPC Contractor', emoji: '🏗️' },
                      { value: 'developer', label: 'Developer', emoji: '💻' },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => update('user_type', opt.value)}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${form.user_type === opt.value ? 'border-forest-900 bg-forest-900/5' : 'border-slate-200 hover:border-slate-300'}`}>
                        <span className="text-2xl block mb-1">{opt.emoji}</span>
                        <span className="text-xs font-medium text-slate-700">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="label">Business type</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'solo', label: 'Solo / Unregistered', desc: 'Individual or informal business' },
                      { value: 'registered', label: 'Registered Company', desc: 'CAC registered business' },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => update('business_type', opt.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${form.business_type === opt.value ? 'border-forest-900 bg-forest-900/5' : 'border-slate-200 hover:border-slate-300'}`}>
                        <p className="font-semibold text-sm text-forest-900">{opt.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Personal details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">First Name *</label>
                    <input className="input" placeholder="Emeka" value={form.first_name} onChange={e => update('first_name', e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <input className="input" placeholder="Okonkwo" value={form.last_name} onChange={e => update('last_name', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input className="input" type="tel" placeholder="+234 801 234 5678" value={form.phone} onChange={e => update('phone', e.target.value)} />
                </div>
                {!isRegistered && (
                  <div>
                    <label className="label">Brand / Business Name</label>
                    <input className="input" placeholder="SunTech Solar Solutions" value={form.brand_name} onChange={e => update('brand_name', e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Company details (registered only) */}
            {step === 3 && isRegistered && (
              <div className="space-y-4">
                <div>
                  <label className="label">Company Name *</label>
                  <input className="input" placeholder="Sunbeam EPC Limited" value={form.company_name} onChange={e => update('company_name', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Company Email</label>
                  <input className="input" type="email" placeholder="info@yourcompany.com" value={form.company_email} onChange={e => update('company_email', e.target.value)} />
                </div>
                <div>
                  <label className="label">State</label>
                  <select className="input" value={form.company_state} onChange={e => update('company_state', e.target.value)}>
                    {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" placeholder="Ikeja" value={form.company_city} onChange={e => update('company_city', e.target.value)} />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input className="input" placeholder="14 Adeola Odeku, Victoria Island" value={form.company_address} onChange={e => update('company_address', e.target.value)} />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8">
              {step > 1 ? (
                <button onClick={() => setStep(s => s - 1)} className="btn-ghost flex items-center gap-2">
                  <RiArrowLeftLine /> Back
                </button>
              ) : <div />}
              {step < totalSteps ? (
                <button onClick={() => setStep(s => s + 1)} className="btn-primary flex items-center gap-2">
                  Continue <RiArrowRightLine />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2">
                  {submitting ? 'Saving...' : 'Complete Setup'}
                  {!submitting && <RiCheckLine />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}