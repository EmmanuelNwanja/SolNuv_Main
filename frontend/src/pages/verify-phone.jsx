import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { RiShieldCheckLine, RiSmartphoneLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function VerifyPhone() {
  const { session, loading, isOnboarded, isPlatformAdmin } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [session, loading, router]);

  useEffect(() => {
    if (!session?.user) return;
    const fromStorage = (() => {
      try {
        const pending = JSON.parse(localStorage.getItem('solnuv_pending_onboarding') || '{}');
        return pending?.phone || '';
      } catch {
        return '';
      }
    })();

    setPhone(fromStorage || session.user.user_metadata?.phone || '');

    // Already-onboarded users (existing accounts) skip phone verification entirely
    if (isOnboarded) {
      router.replace(isPlatformAdmin ? '/admin' : '/dashboard');
      return;
    }

    // New users who already verified their phone move on to onboarding
    if (session.user.user_metadata?.phone_verified) {
      router.replace('/onboarding');
    }
  }, [session?.user, isOnboarded, isPlatformAdmin, router]);

  async function sendOtp() {
    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setSending(true);
    try {
      await authAPI.requestPhoneVerificationOtp({ phone, channel: 'sms' });
      setSent(true);
      toast.success('OTP sent to your phone');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    if (!otp.trim()) {
      toast.error('Enter the OTP code');
      return;
    }

    setVerifying(true);
    try {
      await authAPI.verifyPhoneVerificationOtp({ phone, otp });
      toast.success('Phone verified successfully');
      router.replace('/onboarding');
    } catch (err) {
      toast.error(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <>
      <Head><title>Verify Phone — SolNuv</title></Head>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md card shadow-md">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-forest-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <RiShieldCheckLine className="text-amber-400 text-2xl" />
            </div>
            <h1 className="font-display font-bold text-forest-900 text-2xl">Verify your phone</h1>
            <p className="text-slate-500 text-sm mt-1">Required before completing onboarding</p>
          </div>

          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="label">Phone Number</label>
              <input
                type="tel"
                className="input"
                placeholder="+234 801 234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <button type="button" onClick={sendOtp} disabled={sending} className="btn-outline w-full flex items-center justify-center gap-2">
              <RiSmartphoneLine /> {sending ? 'Sending OTP...' : (sent ? 'Resend OTP' : 'Send OTP')}
            </button>

            <div>
              <label className="label">OTP Code</label>
              <input
                type="text"
                className="input"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
              />
            </div>

            <button type="submit" disabled={verifying || !sent} className="btn-primary w-full">
              {verifying ? 'Verifying...' : 'Verify Phone'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
