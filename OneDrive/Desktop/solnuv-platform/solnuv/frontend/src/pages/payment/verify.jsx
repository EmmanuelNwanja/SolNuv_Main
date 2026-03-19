import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { paymentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FullPageLoader } from '../components/ui/index';
import Head from 'next/head';
import Link from 'next/link';
import { RiCheckboxCircleLine, RiCloseCircleLine } from 'react-icons/ri';

export default function PaymentVerify() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'failed'
  const [plan, setPlan] = useState('');

  useEffect(() => {
    const { reference, trxref } = router.query;
    const ref = reference || trxref;
    if (!ref) return;

    paymentsAPI.verify(ref)
      .then(async r => {
        setPlan(r.data.data?.plan || '');
        await refreshProfile();
        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 3000);
      })
      .catch(() => setStatus('failed'));
  }, [router.query]);

  if (status === 'verifying') return <FullPageLoader message="Verifying your payment..." />;

  return (
    <>
      <Head><title>{status === 'success' ? 'Payment Successful' : 'Payment Failed'} — SolNuv</title></Head>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center shadow-lg">
          {status === 'success' ? (
            <>
              <RiCheckboxCircleLine className="text-6xl text-emerald-500 mx-auto mb-4" />
              <h1 className="font-display font-bold text-2xl text-forest-900 mb-2">Payment Successful!</h1>
              <p className="text-slate-500 mb-2">Your <strong className="text-forest-900">{plan?.toUpperCase()}</strong> plan is now active.</p>
              <p className="text-sm text-slate-400 mb-6">Redirecting to your dashboard in 3 seconds...</p>
              <Link href="/dashboard" className="btn-primary">Go to Dashboard →</Link>
            </>
          ) : (
            <>
              <RiCloseCircleLine className="text-6xl text-red-400 mx-auto mb-4" />
              <h1 className="font-display font-bold text-2xl text-forest-900 mb-2">Payment Not Completed</h1>
              <p className="text-slate-500 mb-6">Your payment could not be verified. You have not been charged. Please try again.</p>
              <div className="flex gap-3 justify-center">
                <Link href="/plans" className="btn-primary">Try Again</Link>
                <Link href="/dashboard" className="btn-ghost">Back to Dashboard</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
