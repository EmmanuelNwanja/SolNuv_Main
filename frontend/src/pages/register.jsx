import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { RiSunLine, RiGoogleLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function Register() {
  const { session, isOnboarded, isPlatformAdmin, profileResolved, signInWithGoogle, signUpWithEmail, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('solo');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session && !loading && profileResolved) {
      const dest = isPlatformAdmin ? '/admin' : (isOnboarded ? '/dashboard' : '/verify-phone');
      router.replace(dest);
    }
  }, [session, loading, profileResolved, isOnboarded, isPlatformAdmin, router]);

  async function handleGoogle() {
    if (!phone.trim()) {
      toast.error('Phone number is required before Google sign up');
      return;
    }

    localStorage.setItem('solnuv_pending_onboarding', JSON.stringify({
      phone,
      business_type: businessType,
    }));

    setSubmitting(true);
    const { error } = await signInWithGoogle();
    if (error) { toast.error(error.message); setSubmitting(false); }
  }

  async function handleEmail(e) {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!phone.trim()) { toast.error('Phone number is required'); return; }
    setSubmitting(true);
    const { error } = await signUpWithEmail(email, password, { phone, business_type: businessType });
    if (error) { toast.error(error.message); setSubmitting(false); }
    else {
      localStorage.setItem('solnuv_pending_onboarding', JSON.stringify({
        phone,
        business_type: businessType,
      }));
      toast.success('Account created! Verify your phone to continue.');
      router.push('/verify-phone');
    }
  }

  return (
    <>
      <Head><title>Create Account — SolNuv</title></Head>
      <div className="auth-shell">
        <div className="auth-wrap">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-forest-900 rounded-xl flex items-center justify-center">
                <RiSunLine className="text-amber-400 text-xl" />
              </div>
              <span className="font-display font-bold text-forest-900 text-2xl">SolNuv</span>
            </Link>
            <h1 className="font-display font-bold text-forest-900 text-2xl">Create your account</h1>
            <p className="text-slate-500 text-sm mt-1">Start from ₦5,000/mo. No credit card required to sign up.</p>
          </div>

          <div className="auth-card">
            <button onClick={handleGoogle} disabled={submitting} className="w-full flex items-center justify-center gap-3 border-2 border-slate-200 rounded-xl py-3 text-sm font-semibold text-slate-700 hover:border-forest-900 hover:bg-forest-900/5 transition-all mb-6 disabled:opacity-50">
              <RiGoogleLine className="text-lg" />
              Sign up with Google
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400 font-medium">or sign up with email</span></div>
            </div>

            <form onSubmit={handleEmail} className="space-y-4">
              <div>
                <label className="label">Registration Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setBusinessType('solo')}
                    className={`p-3 rounded-xl border-2 text-sm font-medium ${businessType === 'solo' ? 'border-forest-900 bg-forest-900/5 text-forest-900' : 'border-slate-200 text-slate-600'}`}>
                    Solo Engineer
                  </button>
                  <button type="button" onClick={() => setBusinessType('registered')}
                    className={`p-3 rounded-xl border-2 text-sm font-medium ${businessType === 'registered' ? 'border-forest-900 bg-forest-900/5 text-forest-900' : 'border-slate-200 text-slate-600'}`}>
                    Registered Company
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Work email</label>
                <input type="email" className="input" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input type="tel" className="input" placeholder="+234 801 234 5678" value={phone} onChange={e => setPhone(e.target.value)} required />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className="input pr-10" placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <RiEyeOffLine /> : <RiEyeLine />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input type="password" className="input" placeholder="Repeat your password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Creating account...' : 'Create Free Account'}
              </button>
              <p className="text-xs text-center text-slate-400">
                By signing up you agree to our{' '}
                <Link href="/terms" className="underline hover:text-forest-900">Terms of Service</Link>
                {' & '}
                <Link href="/privacy" className="underline hover:text-forest-900">Privacy Policy</Link>
              </p>
            </form>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-forest-900 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </>
  );
}
