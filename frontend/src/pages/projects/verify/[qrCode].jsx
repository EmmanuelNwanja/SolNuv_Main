import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { projectsAPI } from '../../../services/api';
import { LoadingSpinner } from '../../../components/ui';

export default function ProjectVerifyPage() {
  const router = useRouter();
  const { qrCode } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState(null);

  useEffect(() => {
    if (!qrCode) return;

    const fetchVerification = async () => {
      setLoading(true);
      setError('');

      try {
        const { data } = await projectsAPI.verify(qrCode);
        setVerification(data.data);
      } catch (err) {
        setVerification(null);
        setError(err.response?.data?.message || 'Project verification failed');
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [qrCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-slate-600 text-sm">Verifying project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Project Verification - SolNuv</title>
        </Head>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
            <h1 className="text-xl font-semibold text-slate-900">Verification Unavailable</h1>
            <p className="text-slate-600 mt-2">{error}</p>
            <Link href="/" className="inline-block mt-4 text-forest-900 font-semibold hover:underline">
              Return Home
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Project Verification - SolNuv</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-forest-900 to-emerald-900 text-white">
              <p className="text-xs tracking-widest uppercase text-white/70">SolNuv Verification</p>
              <h1 className="text-2xl font-display font-bold mt-1">{verification?.project_name}</h1>
              <p className="text-sm text-white/80 mt-1">{verification?.location}</p>
            </div>

            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-slate-500">Status</p>
                <p className="font-semibold text-slate-900 mt-1 capitalize">{verification?.status || 'Unknown'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-slate-500">Installation Date</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {verification?.installation_date
                    ? new Date(verification.installation_date).toLocaleDateString('en-NG')
                    : 'N/A'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-slate-500">Total Panels</p>
                <p className="font-semibold text-slate-900 mt-1">{verification?.total_panels ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-slate-500">Total Batteries</p>
                <p className="font-semibold text-slate-900 mt-1">{verification?.total_batteries ?? 0}</p>
              </div>
            </div>

            <div className="px-6 pb-6 text-xs text-slate-500">
              <p>Verified by {verification?.verified_by || 'SolNuv Platform'}</p>
              <p>
                Verified at{' '}
                {verification?.verified_at ? new Date(verification.verified_at).toLocaleString('en-NG') : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
