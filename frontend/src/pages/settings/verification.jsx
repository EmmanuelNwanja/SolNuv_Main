import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { supabase } from '../../utils/supabase';
import { getDashboardLayout } from '../../components/Layout';
import { RiShieldCheckLine, RiCloseLine, RiCheckLine, RiTimeLine, RiUploadCloudLine, RiAlertLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function VerificationSettings() {
  const { profile, verificationStatus, isVerified, business_type, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const isSolo = profile?.business_type === 'solo';
  const isPending = verificationStatus === 'pending' || verificationStatus === 'pending_admin_review';
  const isRejected = verificationStatus === 'rejected';
  const isUnverified = verificationStatus === 'unverified';

  useEffect(() => {
    loadVerificationStatus();
  }, []);

  async function loadVerificationStatus() {
    setLoading(true);
    try {
      const { data } = await authAPI.getVerificationStatus();
      if (data?.data) {
        setDocuments(data.data.documents || []);
        setNotes(data.data.verification_notes || '');
      }
    } catch (err) {
      console.error('Failed to load verification status', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestVerification() {
    setSubmitting(true);
    try {
      const payload = { notes };
      
      if (!isSolo) {
        if (documents.length === 0 || !documents[0]?.file_url) {
          toast.error('Please upload your CAC certificate first');
          setSubmitting(false);
          return;
        }
        payload.document_url = documents[0].file_url;
        payload.document_type = 'cac_certificate';
        payload.original_filename = documents[0].original_filename;
      }

      await authAPI.requestVerification(payload);
      toast.success(isSolo 
        ? 'Self-attestation submitted. Your account will be verified shortly.' 
        : 'Verification request submitted. Our team will review your CAC document.');
      await refreshProfile();
      await loadVerificationStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit verification request');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelRequest() {
    setSubmitting(true);
    try {
      await authAPI.cancelVerificationRequest();
      toast.success('Verification request cancelled');
      await refreshProfile();
      await loadVerificationStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel request');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, and PNG files are allowed');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${profile?.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('verification-documents')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (error) {
        if (error.message?.includes('Bucket not found')) {
          toast.error('Upload storage not configured. Please contact support.');
        } else {
          toast.error('Upload failed: ' + error.message);
        }
        return;
      }

      const { data: urlData } = supabase.storage
        .from('verification-documents')
        .getPublicUrl(fileName);

      setDocuments([{
        id: 'new',
        document_type: 'cac_certificate',
        file_url: urlData.publicUrl,
        original_filename: file.name,
      }]);
      toast.success('Document uploaded successfully');
    } catch (err) {
      toast.error('Upload failed');
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  const statusConfig = {
    verified: { color: 'green', icon: RiCheckLine, label: 'Verified', desc: 'Your account is fully verified.' },
    pending: { color: 'amber', icon: RiTimeLine, label: 'Pending Review', desc: 'Your verification is being reviewed.' },
    pending_admin_review: { color: 'amber', icon: RiTimeLine, label: 'Under Review', desc: 'Our team is reviewing your documents.' },
    rejected: { color: 'red', icon: RiCloseLine, label: 'Rejected', desc: 'Your verification was not approved.' },
    unverified: { color: 'gray', icon: RiAlertLine, label: 'Not Verified', desc: 'Complete verification to unlock all features.' },
  };

  const status = statusConfig[verificationStatus] || statusConfig.unverified;
  const StatusIcon = status.icon;

  return (
    <>
      <Head><title>Verification Settings — SolNuv</title></Head>

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-forest-900 flex items-center justify-center">
            <RiShieldCheckLine className="text-amber-400 text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-forest-900">Account Verification</h1>
            <p className="text-sm text-slate-500">Verify your account to unlock full platform access</p>
          </div>
        </div>

        {loading ? (
          <div className="card text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-forest-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm mt-3">Loading...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Card */}
            <div className={`card border-l-4 ${
              status.color === 'green' ? 'border-l-green-500 bg-green-50' :
              status.color === 'amber' ? 'border-l-amber-500 bg-amber-50' :
              status.color === 'red' ? 'border-l-red-500 bg-red-50' :
              'border-l-slate-400 bg-slate-50'
            }`}>
              <div className="flex items-start gap-4">
                <StatusIcon className={`w-8 h-8 ${
                  status.color === 'green' ? 'text-green-600' :
                  status.color === 'amber' ? 'text-amber-600' :
                  status.color === 'red' ? 'text-red-600' :
                  'text-slate-500'
                }`} />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-slate-900">{status.label}</h3>
                  <p className="text-sm text-slate-600 mt-1">{status.desc}</p>
                  {isRejected && profile?.verification_rejection_reason && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-red-200">
                      <p className="text-xs font-medium text-red-700 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-800">{profile.verification_rejection_reason}</p>
                      <button
                        onClick={() => {
                          const cards = document.querySelectorAll('.card');
                          cards.forEach(card => {
                            if (card.querySelector('.btn-primary')) {
                              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          });
                        }}
                        className="mt-3 text-xs text-red-700 underline hover:no-underline"
                      >
                        Click to submit new verification
                      </button>
                    </div>
                  )}
                  {isPending && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-700">
                      <RiTimeLine className="w-4 h-4" />
                      Requested: {profile?.verification_requested_at 
                        ? new Date(profile.verification_requested_at).toLocaleDateString()
                        : 'Recently'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Card */}
            {isVerified ? (
              <div className="card bg-green-50 border border-green-200">
                <div className="flex items-center gap-3 text-green-800">
                  <RiCheckLine className="w-6 h-6" />
                  <div>
                    <p className="font-medium">Full Access Enabled</p>
                    <p className="text-sm text-green-700">All platform tools and features are available.</p>
                  </div>
                </div>
                {profile?.verified_at && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <p className="text-xs text-green-700">
                      <span className="font-medium">Verified on:</span>{' '}
                      {new Date(profile.verified_at).toLocaleDateString('en-NG', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </p>
                    {profile.business_type !== 'solo' && (
                      <p className="text-xs text-green-700 mt-1">
                        Your CAC document has been reviewed and approved.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : isPending ? (
              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-3">Waiting for Review</h3>
                <p className="text-sm text-slate-600 mb-4">
                  {isSolo 
                    ? 'Your self-attestation is being reviewed. You will receive an SMS notification once approved.'
                    : 'Your CAC document is being reviewed by our team. You will receive an SMS notification once approved.'}
                </p>
                <div className="flex gap-3">
                  {documents.length > 0 && (
                    <a 
                      href={documents[0]?.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-secondary"
                    >
                      View Uploaded Document
                    </a>
                  )}
                  <button onClick={handleCancelRequest} disabled={submitting} className="btn-outline">
                    Cancel Request
                  </button>
                </div>
              </div>
            ) : (
              <div className="card">
                <h3 className="font-semibold text-slate-900 mb-2">
                  {isSolo ? 'Self-Attestation' : 'Document Verification'}
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  {isSolo 
                    ? 'As a solo user, verify your account by attesting that the information provided during registration is accurate. No documents required.'
                    : 'As a registered business, please upload your CAC (Certificate of Incorporation) for verification. This helps us ensure platform integrity.'}
                </p>

                {/* Notes */}
                <div className="mb-4">
                  <label className="label">Additional Notes (Optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input min-h-[80px]"
                    placeholder="Any additional information you'd like to share..."
                    maxLength={500}
                  />
                </div>

                {/* File Upload for Companies */}
                {!isSolo && (
                  <div className="mb-4">
                    <label className="label">CAC Certificate *</label>
                    {documents.length > 0 ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <RiCheckLine className="text-green-600 w-5 h-5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-green-800 truncate">
                            {documents[0]?.original_filename || 'Document uploaded'}
                          </p>
                          <a 
                            href={documents[0]?.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-green-700 underline"
                          >
                            View document
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDocuments([])}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <RiCloseLine className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-forest-900 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <RiUploadCloudLine className="w-8 h-8 text-slate-400 mb-2" />
                          <p className="text-sm text-slate-600">Click to upload CAC certificate</p>
                          <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG (max 10MB)</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileUpload}
                          disabled={uploading}
                        />
                      </label>
                    )}
                    {uploading && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                        <div className="w-4 h-4 border-2 border-forest-900 border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleRequestVerification}
                  disabled={submitting || (!isSolo && documents.length === 0)}
                  className="btn-primary w-full"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    isSolo ? 'Submit Self-Attestation' : 'Submit for Verification'
                  )}
                </button>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">What happens next?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                {isSolo ? (
                  <>
                    <li>1. Submit your self-attestation</li>
                    <li>2. Our team reviews your account</li>
                    <li>3. Receive SMS notification when approved</li>
                    <li>4. Full access unlocked immediately</li>
                  </>
                ) : (
                  <>
                    <li>1. Upload your CAC certificate</li>
                    <li>2. Our team reviews the document</li>
                    <li>3. Receive SMS notification when approved</li>
                    <li>4. Full access unlocked upon approval</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

VerificationSettings.getLayout = getDashboardLayout;
