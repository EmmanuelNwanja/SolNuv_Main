import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { getAppHomePath } from '../utils/partnerPortal';
import { RiSunLine, RiGoogleLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import toast from 'react-hot-toast';
import { MotionItem, MotionSection, MotionStagger } from '../components/PageMotion';

export default function Register() {
  const { session, profile, isOnboarded, isPlatformAdmin, profileResolved, signInWithGoogle, signUpWithEmail, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('solo');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('solnuv_register_cooldown');
    if (saved) {
      const end = parseInt(saved, 10);
      if (end > Date.now()) {
        setCooldownEnd(end);
      } else {
        localStorage.removeItem('solnuv_register_cooldown');
      }
    }
  }, []);

  useEffect(() => {
    if (!cooldownEnd) return;
    const remaining = cooldownEnd - Date.now();
    if (remaining <= 0) {
      setCooldownEnd(null);
      localStorage.removeItem('solnuv_register_cooldown');
      return;
    }
    const timer = setTimeout(() => {
      setCooldownEnd(null);
      localStorage.removeItem('solnuv_register_cooldown');
    }, remaining);
    return () => clearTimeout(timer);
  }, [cooldownEnd]);

  useEffect(() => {
    if (session && !loading && profileResolved) {
      const dest = isPlatformAdmin ? '/admin' : getAppHomePath(profile);
      router.replace(dest);
    }
  }, [session, loading, profileResolved, isOnboarded, isPlatformAdmin, profile, router]);

  async function handleGoogle() {
    if (cooldownEnd) {
      const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
      toast.error(`Please wait ${remaining}s before trying again`);
      return;
    }
    if (!phone.trim()) {
      toast.error('Phone number is required before Google sign up');
      return;
    }
    if (!agreed) {
      toast.error('Please accept the Terms of Service and Privacy Policy to continue');
      return;
    }

    localStorage.setItem('solnuv_pending_onboarding', JSON.stringify({
      phone,
      business_type: businessType,
    }));

    setSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        // Clear pending metadata — a failed OAuth attempt must not pollute a later email signup
        localStorage.removeItem('solnuv_pending_onboarding');
        const errorMsg = error.message || '';
        if (errorMsg.includes('popup_closed') || errorMsg.includes('popup')) {
          toast.error('Sign-in popup was closed. Please try again.');
        } else if (error.status === 429 || errorMsg.includes('rate') || errorMsg.includes('too many')) {
          toast.error('Too many attempts. Please wait 2 minutes before trying again.');
          const cooldown = Date.now() + 120000;
          setCooldownEnd(cooldown);
          localStorage.setItem('solnuv_register_cooldown', String(cooldown));
        } else {
          toast.error(errorMsg || 'Google sign-in failed. Please try again.');
        }
        setSubmitting(false);
      }
    } catch (err) {
      localStorage.removeItem('solnuv_pending_onboarding');
      toast.error('An unexpected error occurred. Please try again.');
      setSubmitting(false);
    }
  }

  async function handleEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cooldownEnd) {
      const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
      toast.error(`Please wait ${remaining}s before trying again`);
      return;
    }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (!phone.trim()) { toast.error('Phone number is required'); return; }
    if (!agreed) { toast.error('Please accept the Terms of Service and Privacy Policy to continue'); return; }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address'); return;
    }
    
    setSubmitting(true);
    try {
      const { error, data } = await signUpWithEmail(email, password, { phone, business_type: businessType });
      
      if (error) {
        const errorMsg = error.message || '';
        const errorStatus = error.status;
        
        // Check for duplicate email errors (409 Conflict)
        if (errorStatus === 409 || 
            errorMsg.toLowerCase().includes('already registered') || 
            errorMsg.toLowerCase().includes('already exists') || 
            errorMsg.toLowerCase().includes('already been registered') ||
            errorMsg.toLowerCase().includes('user already registered') ||
            errorMsg.toLowerCase().includes('existing login method')) {
          toast.error('An account with this email already exists. Please sign in using your existing login method.');
          setSubmitting(false);
          return;
        }
        
        if (errorStatus === 429 || errorMsg.includes('rate') || errorMsg.includes('too many')) {
          toast.error('Too many signup attempts. Please wait 2 minutes before trying again.');
          const cooldown = Date.now() + 120000;
          setCooldownEnd(cooldown);
          localStorage.setItem('solnuv_register_cooldown', String(cooldown));
          setSubmitting(false);
          return;
        }
        
        if (errorMsg.includes('invalid email') || errorMsg.includes('email format')) {
          toast.error('Please enter a valid email address.');
          setSubmitting(false);
          return;
        }
        
        if (errorMsg.includes('weak password') || errorMsg.includes('Password should be')) {
          toast.error('Password is too weak. Use at least 8 characters with a mix of letters and numbers.');
          setSubmitting(false);
          return;
        }
        
        // Generic fallback with user-friendly message
        toast.error(errorMsg || 'Registration failed. Please try again.');
        setSubmitting(false);
        return;
      }
      
      // Check if email confirmation is required
      const signupData = data as { user?: unknown; session?: unknown } | null;
      if (signupData?.user && !signupData?.session) {
        localStorage.setItem('solnuv_pending_onboarding', JSON.stringify({
          phone,
          business_type: businessType,
        }));
        toast.success('Account created! Please check your email to confirm your account.');
        router.push('/dashboard');
        return;
      }
      
      localStorage.setItem('solnuv_pending_onboarding', JSON.stringify({
        phone,
        business_type: businessType,
      }));
      toast.success('Account created! Complete your profile to continue.');
      router.push('/dashboard');
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Create Account — SolNuv | Solar Project Design and Lifecycle Workflows</title>
        <meta name="description" content="Create your SolNuv account to design and evaluate solar projects, model long-horizon outcomes, and manage compliance-ready lifecycle workflows." />
      </Head>
      <div className="auth-shell">
        <MotionSection className="auth-wrap">
          <MotionStagger className="text-center mb-8" delay={0.02}>
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-forest-900 rounded-xl flex items-center justify-center">
                <RiSunLine className="text-amber-400 text-xl" />
              </div>
              <span className="font-display font-bold text-forest-900 text-2xl">SolNuv</span>
            </Link>
            <h1 className="auth-headline">Create your account</h1>
            <p className="text-slate-500 text-sm mt-1">Set up your workspace for design workflows, reporting, and lifecycle operations.</p>
          </MotionStagger>

          <MotionItem className="auth-card reveal-lift">
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
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-forest-900 accent-forest-900 cursor-pointer"
                />
                <span className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-700 transition-colors">
                  I have read and agree to the{' '}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline hover:text-forest-900" onClick={e => e.stopPropagation()}>Terms of Service</Link>
                  {' and '}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline hover:text-forest-900" onClick={e => e.stopPropagation()}>Privacy Policy</Link>
                  . I confirm I am at least 18 years old.
                </span>
              </label>
              <button type="submit" disabled={submitting || !agreed || !!cooldownEnd} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? 'Creating account...' : cooldownEnd ? `Wait ${Math.ceil((cooldownEnd - Date.now()) / 1000)}s` : 'Create Account'}
              </button>
            </form>
          </MotionItem>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-forest-900 font-semibold hover:underline">Sign in</Link>
          </p>
          <p className="text-center text-xs text-slate-400 mt-2">
            Need team onboarding support? <Link href="/contact" className="hover:underline text-slate-500">Contact SolNuv</Link>
          </p>
        </MotionSection>
      </div>
    </>
  );
}
