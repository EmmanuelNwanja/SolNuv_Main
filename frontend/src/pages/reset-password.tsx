import Head from 'next/head';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { authAPI } from '../services/api';
import { RiSunLine, RiMailLine, RiShieldUserLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

type ResetTab = 'request' | 'verify' | 'reset' | 'success' | 'admin';

type ResetForm = {
  email: string;
  phone: string;
  channel: string;
  otp: string;
  new_password: string;
  confirm_password: string;
};

function axiosMessage(err: unknown, fallback: string) {
  if (!axios.isAxiosError(err)) return fallback;
  const msg = (err.response?.data as { message?: string } | undefined)?.message;
  return msg || fallback;
}

export default function ResetPasswordPage() {
  const [activeTab, setActiveTab] = useState<ResetTab>('request');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ResetForm>({
    email: '',
    phone: '',
    channel: 'sms',
    otp: '',
    new_password: '',
    confirm_password: '',
  });

  const update = <K extends keyof ResetForm>(field: K, value: ResetForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authAPI.requestPasswordResetOtp({
        email: form.email,
        phone: form.phone,
        channel: form.channel,
      });
      toast.success('OTP sent successfully');
      setActiveTab('verify');
    } catch (err: unknown) {
      toast.error(axiosMessage(err, 'Failed to send OTP'));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyAdminOtp(e: FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!form.otp.trim()) {
      toast.error('OTP code is required');
      return;
    }

    setSubmitting(true);
    try {
      await authAPI.verifyPasswordResetOtp({ email: form.email, otp: form.otp });
      toast.success('OTP verified');
      setActiveTab('reset');
    } catch (err: unknown) {
      toast.error(axiosMessage(err, 'Invalid or expired OTP'));
    } finally {
      setSubmitting(false);
    }
  }

  async function completeReset(e: FormEvent) {
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
      setActiveTab('success');
    } catch (err: unknown) {
      toast.error(axiosMessage(err, 'Failed to reset password'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password — SolNuv</title>
      </Head>
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
            <p className="text-slate-500 text-sm mt-1">Reset your password securely</p>
          </div>

          <div className="auth-card">
            {activeTab === 'success' ? (
              <div className="text-center py-3">
                <p className="text-sm text-slate-600 mb-4">Your password has been reset successfully.</p>
                <Link href="/login" className="btn-primary inline-block">
                  Go to Sign In
                </Link>
              </div>
            ) : (
              <>
                <div className="flex border-b border-slate-200 mb-6">
                  <button
                    type="button"
                    onClick={() => setActiveTab('request')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'request'
                        ? 'text-forest-900 border-forest-900'
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    <RiMailLine />
                    Request OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'admin'
                        ? 'text-forest-900 border-forest-900'
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    <RiShieldUserLine />
                    Use Admin Code
                  </button>
                </div>

                {activeTab === 'request' && (
                  <form onSubmit={requestOtp} className="space-y-4">
                    <p className="text-xs text-slate-500 mb-4">
                      Enter your details to receive an OTP via SMS or WhatsApp.
                    </p>
                    <div>
                      <label className="label">Email</label>
                      <input
                        className="input"
                        type="email"
                        value={form.email}
                        onChange={(e) => update('email', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Phone Number</label>
                      <input
                        className="input"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => update('phone', e.target.value)}
                        placeholder="+234 801 234 5678"
                        required
                      />
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

                {activeTab === 'admin' && (
                  <form onSubmit={verifyAdminOtp} className="space-y-4">
                    <p className="text-xs text-slate-500 mb-4">Enter the OTP code provided by a SolNuv administrator.</p>
                    <div>
                      <label className="label">Email</label>
                      <input
                        className="input"
                        type="email"
                        value={form.email}
                        onChange={(e) => update('email', e.target.value)}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Admin-Provided OTP Code</label>
                      <input
                        className="input"
                        value={form.otp}
                        onChange={(e) => update('otp', e.target.value)}
                        placeholder="6-digit code"
                        maxLength={6}
                        required
                      />
                    </div>
                    <button type="submit" disabled={submitting} className="btn-primary w-full">
                      {submitting ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </form>
                )}

                {activeTab === 'verify' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (form.new_password !== form.confirm_password) {
                        toast.error('Passwords do not match');
                        return;
                      }
                      void completeReset(e);
                    }}
                    className="space-y-4"
                  >
                    <p className="text-xs text-slate-500 mb-4">Enter the OTP sent to your phone and choose a new password.</p>
                    <div>
                      <label className="label">OTP Code</label>
                      <input
                        className="input"
                        value={form.otp}
                        onChange={(e) => update('otp', e.target.value)}
                        placeholder="6-digit code"
                        maxLength={6}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">New Password</label>
                      <input
                        className="input"
                        type="password"
                        minLength={8}
                        value={form.new_password}
                        onChange={(e) => update('new_password', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Confirm New Password</label>
                      <input
                        className="input"
                        type="password"
                        minLength={8}
                        value={form.confirm_password}
                        onChange={(e) => update('confirm_password', e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" disabled={submitting} className="btn-primary w-full">
                      {submitting ? 'Resetting...' : 'Reset Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('request')}
                      className="w-full text-sm text-slate-500 hover:text-forest-900"
                    >
                      ← Back to request new OTP
                    </button>
                  </form>
                )}

                {activeTab === 'reset' && (
                  <form onSubmit={completeReset} className="space-y-4">
                    <p className="text-xs text-slate-500 mb-4">Choose a new password for your account.</p>
                    <div>
                      <label className="label">New Password</label>
                      <input
                        className="input"
                        type="password"
                        minLength={8}
                        value={form.new_password}
                        onChange={(e) => update('new_password', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Confirm New Password</label>
                      <input
                        className="input"
                        type="password"
                        minLength={8}
                        value={form.confirm_password}
                        onChange={(e) => update('confirm_password', e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" disabled={submitting} className="btn-primary w-full">
                      {submitting ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
