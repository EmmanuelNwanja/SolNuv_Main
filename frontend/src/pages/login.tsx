import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { RiSunLine, RiGoogleLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import toast from 'react-hot-toast';
import { MotionItem, MotionSection, MotionStagger } from '../components/PageMotion';

export default function Login() {
  const { session, isOnboarded, isPlatformAdmin, profileResolved, signInWithGoogle, signInWithEmail, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session && !loading && profileResolved) {
      // Check admin first — admins go directly to /admin regardless of onboarding status
      const redirectUrl = isPlatformAdmin ? '/admin' : (!isOnboarded ? '/onboarding' : '/dashboard');
      router.replace(redirectUrl);
    }
  }, [session, loading, profileResolved, isOnboarded, isPlatformAdmin, router]);

  async function handleGoogle() {
    setSubmitting(true);
    const { error } = await signInWithGoogle();
    if (error) toast.error(error.message);
    setSubmitting(false);
  }

  async function handleEmail(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Welcome back!');
      // Redirect will be handled by useEffect above
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign In — SolNuv | Solar Project Intelligence Workspace</title>
        <meta name="description" content="Sign in to access SolNuv design workflows, financial scenario tools, lifecycle records, and compliance support features." />
      </Head>
      <div className="auth-shell">
        <MotionSection className="auth-wrap">
          {/* Logo */}
          <MotionStagger className="text-center mb-8" delay={0.02}>
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-forest-900 rounded-xl flex items-center justify-center">
                <RiSunLine className="text-amber-400 text-xl" />
              </div>
              <span className="font-display font-bold text-forest-900 text-2xl">SolNuv</span>
            </Link>
            <h1 className="auth-headline">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-1">Continue your project operations workspace.</p>
          </MotionStagger>

          <MotionItem className="auth-card reveal-lift">
            {/* Google */}
            <button onClick={handleGoogle} disabled={submitting} className="w-full flex items-center justify-center gap-3 border-2 border-slate-200 rounded-xl py-3 text-sm font-semibold text-slate-700 hover:border-forest-900 hover:bg-forest-900/5 transition-all mb-6 disabled:opacity-50">
              <RiGoogleLine className="text-lg" />
              Continue with Google
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-slate-400 font-medium">or sign in with email</span></div>
            </div>

            <form onSubmit={handleEmail} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input type="email" className="input" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className="input pr-10" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <RiEyeOffLine /> : <RiEyeLine />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <Link href="/reset-password" className="text-xs text-forest-900 hover:underline">Forgot password?</Link>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </MotionItem>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link href="/register" className="text-forest-900 font-semibold hover:underline">Get started</Link>
          </p>
          <p className="text-center text-xs text-slate-400 mt-2">
            Need enterprise onboarding help? <Link href="/contact" className="hover:underline text-slate-500">Contact the team</Link>
          </p>
        </MotionSection>
      </div>
    </>
  );
}
