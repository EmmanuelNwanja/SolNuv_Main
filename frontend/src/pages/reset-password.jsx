import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { authAPI } from '../services/api';
import { RiSunLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: '',
    phone: '',
    channel: 'sms',
    otp: '',
    new_password: '',
    confirm_password: '',
  });

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function requestOtp(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authAPI.requestPasswordResetOtp({
        email: form.email,
        phone: form.phone,
        channel: form.channel,
      });
      toast.success('OTP sent successfully');
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authAPI.verifyPasswordResetOtp({ email: form.email, otp: form.otp });
      toast.success('OTP verified');
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function completeReset(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await authAPI.completePasswordReset({
        email: form.email,
        otp: form.otp,
        new_password: form.new_password,
      });
      toast.success('Password reset successful. You can now sign in.');
      setStep(4);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head><title>Reset Password — SolNuv</title></Head>
      <div className="auth-shell">
        <div className="auth-wrap">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-forest-900 rounded-xl flex items-center justify-center">
                <RiSunLine className="text-amber-400 text-xl" />
              </div>
              <span className="font-display font-bold text-forest-900 text-2xl">SolNuv</span>
            </Link>
            <h1 className="font-display font-bold text-forest-900 text-2xl">Reset Password</h1>
            <p className="text-slate-500 text-sm mt-1">Receive an OTP via SMS or WhatsApp and reset securely</p>
          </div>

          <div className="auth-card">
            {step === 1 && (
              <form onSubmit={requestOtp} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input className="input" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+234 801 234 5678" required />
                </div>
                <div>
                  <label className="label">Delivery Channel</label>
                  <select className="input" value={form.channel} onChange={(e) => update('channel', e.target.value)}>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={verifyOtp} className="space-y-4">
                <p className="text-xs text-slate-500">Your OTP expires in 10 minutes. If it expires, go back and request a new code.</p>
                <div>
                  <label className="label">Enter OTP Code</label>
                  <input className="input" value={form.otp} onChange={(e) => update('otp', e.target.value)} placeholder="6-digit code" required />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? 'Verifying...' : 'Verify OTP'}
                </button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={completeReset} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <input className="input" type="password" minLength={8} value={form.new_password} onChange={(e) => update('new_password', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input className="input" type="password" minLength={8} value={form.confirm_password} onChange={(e) => update('confirm_password', e.target.value)} required />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}

            {step === 4 && (
              <div className="text-center py-3">
                <p className="text-sm text-slate-600 mb-4">Your password has been reset successfully.</p>
                <Link href="/login" className="btn-primary inline-block">Go to Sign In</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
