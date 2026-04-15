import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { RiCloseLine, RiShieldCheckLine, RiAlertLine } from 'react-icons/ri';

const DISMISSAL_KEY = 'solnuv_verification_prompt_dismissed';

export default function VerificationPrompt() {
  const { isVerified, verificationStatus } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const wasDismissed = sessionStorage.getItem(DISMISSAL_KEY) === 'true';
      setDismissed(wasDismissed);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(DISMISSAL_KEY, 'true');
    }
  };

  if (!mounted) return null;

  if (isVerified) return null;
  if (dismissed) return null;

  const isPending = verificationStatus === 'pending' || verificationStatus === 'pending_admin_review';
  const isRejected = verificationStatus === 'rejected';

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isPending ? (
            <RiAlertLine className="w-5 h-5 text-amber-600" />
          ) : (
            <RiShieldCheckLine className="w-5 h-5 text-amber-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-amber-900">
              {isPending
                ? 'Verification Pending'
                : isRejected
                ? 'Verification Rejected'
                : 'Account Verification Required'}
            </h4>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
              aria-label="Dismiss"
            >
              <RiCloseLine className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-amber-700 mt-1">
            {isPending
              ? 'Your verification is being reviewed by our team. You will be notified once approved.'
              : isRejected
              ? 'Your previous verification was not approved. Please submit a new request.'
              : 'Complete verification to unlock full access to all platform tools and features.'}
          </p>
          {!isPending && (
            <Link
              href="/settings/verification"
              className="inline-flex items-center gap-1 text-sm font-medium text-amber-900 hover:text-amber-700 mt-2 underline"
            >
              Go to Verification Settings →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
