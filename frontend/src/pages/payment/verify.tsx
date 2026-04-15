import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { paymentsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FullPageLoader } from '../../components/ui/index';
import Head from 'next/head';
import Link from 'next/link';
import { RiCheckboxCircleLine, RiCloseCircleLine } from 'react-icons/ri';

type VerifyStatus = 'verifying' | 'success' | 'failed';

export default function PaymentVerify() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<VerifyStatus>('verifying');
  const [plan, setPlan] = useState('');
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [reference, setReference] = useState('');
  const [errorMessage, setErrorMessage] = useState(
    'We could not confirm your payment yet. If you were charged, do not pay again. Retry after signing in or contact support with your reference.'
  );

  useEffect(() => {
    if (!router.isReady) return;
    const { reference: refParam, trxref } = router.query;
    const ref = refParam ?? trxref;
    if (!ref) return;
    const refStr = Array.isArray(ref) ? ref[0] : ref;
    setReference(refStr);

    paymentsAPI
      .verify(refStr)
      .then(async (r) => {
        const payload = r.data?.data as { plan?: string; billing_interval?: string } | undefined;
        setPlan(payload?.plan ?? '');
        setBillingInterval(payload?.billing_interval ?? 'monthly');
        await refreshProfile();
        setStatus('success');
        setTimeout(() => void router.push('/dashboard'), 3000);
      })
      .catch((err: unknown) => {
        const msg = axios.isAxiosError(err)
          ? String((err.response?.data as { message?: string } | undefined)?.message ?? '')
          : '';
        setErrorMessage(
          msg ||
            'We could not confirm your payment yet. If you were charged, do not pay again. Retry after signing in or contact support with your reference.'
        );
        setStatus('failed');
      });
  }, [router.isReady, router.query.reference, router.query.trxref, refreshProfile]);

  if (status === 'verifying') return <FullPageLoader message="Verifying your payment..." />;

  return (
    <>
      <Head>
        <title>{status === 'success' ? 'Payment Successful' : 'Payment Failed'} — SolNuv</title>
      </Head>
      <div className="auth-shell">
        <div className="auth-card max-w-md w-full text-center">
          {status === 'success' ? (
            <>
              <RiCheckboxCircleLine className="text-6xl text-emerald-500 mx-auto mb-4" />
              <h1 className="font-display font-bold text-2xl text-forest-900 mb-2">Payment Successful!</h1>
              <p className="text-slate-500 mb-2">
                Your <strong className="text-forest-900">{plan?.toUpperCase()}</strong> plan is now active.
              </p>
              <p className="text-xs text-slate-400 mb-2">
                Billing cycle: {billingInterval === 'annual' ? 'Annual' : 'Monthly'} (auto-renewal managed securely)
              </p>
              <p className="text-sm text-slate-400 mb-6">Redirecting to your dashboard in 3 seconds...</p>
              <Link href="/dashboard" className="btn-primary">
                Go to Dashboard →
              </Link>
            </>
          ) : (
            <>
              <RiCloseCircleLine className="text-6xl text-red-400 mx-auto mb-4" />
              <h1 className="font-display font-bold text-2xl text-forest-900 mb-2">Payment Not Completed</h1>
              <p className="text-slate-500 mb-3">{errorMessage}</p>
              {reference && (
                <p className="text-xs text-slate-400 mb-6">
                  Reference: <strong className="text-slate-600">{reference}</strong>
                </p>
              )}
              <div className="flex gap-3 justify-center">
                <Link href="/plans" className="btn-primary">
                  Try Again
                </Link>
                <Link href="/dashboard" className="btn-ghost">
                  Back to Dashboard
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
