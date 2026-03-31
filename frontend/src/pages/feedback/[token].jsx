import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { dashboardAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function PublicFeedbackForm() {
  const router = useRouter();
  const { token } = router.query;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    rating: 5,
    comment: '',
    consent_to_showcase: true,
  });
  const [done, setDone] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function submit(e) {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    try {
      await dashboardAPI.submitPublicFeedback(token, form);
      setDone(true);
      toast.success('Thank you for your feedback');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head><title>Project Feedback — SolNuv</title></Head>
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <div className="w-full max-w-xl card">
          <h1 className="font-display font-bold text-2xl text-forest-900">Project Feedback</h1>
          <p className="text-sm text-slate-500 mt-1">Rate your installer and share your experience.</p>

          {done ? (
            <div className="mt-6 text-center">
              <p className="text-emerald-700 font-semibold">Feedback submitted successfully.</p>
              <Link href="/" className="btn-primary inline-block mt-4">Return Home</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4 mt-6">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Name</label>
                  <input className="input" value={form.client_name} onChange={(e) => update('client_name', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.client_email} onChange={(e) => update('client_email', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.client_phone} onChange={(e) => update('client_phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Rating</label>
                <select className="input" value={form.rating} onChange={(e) => update('rating', Number(e.target.value))}>
                  <option value={5}>5 - Excellent</option>
                  <option value={4}>4 - Very Good</option>
                  <option value={3}>3 - Good</option>
                  <option value={2}>2 - Fair</option>
                  <option value={1}>1 - Poor</option>
                </select>
              </div>
              <div>
                <label className="label">Comments</label>
                <textarea className="input min-h-[110px]" value={form.comment} onChange={(e) => update('comment', e.target.value)} placeholder="Share your experience" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.consent_to_showcase} onChange={(e) => update('consent_to_showcase', e.target.checked)} />
                Allow this feedback to appear on public portfolio pages
              </label>
              <button className="btn-primary w-full" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Feedback'}</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
