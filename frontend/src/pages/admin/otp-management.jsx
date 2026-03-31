import Head from 'next/head';
import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { getAdminLayout } from '../../components/Layout';
import { RiCheckLine, RiCloseLine, RiFileCopyLine, RiRefreshLine, RiAddLine } from 'react-icons/ri';
import AdminRoute from '../../components/AdminRoute';
import toast from 'react-hot-toast';

export default function OtpManagement() {
  const [activeTab, setActiveTab] = useState('pending');
  const [otps, setOtps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingOtp, setGeneratingOtp] = useState(false);

  const [generateForm, setGenerateForm] = useState({
    email: '',
    phone: '',
  });

  useEffect(() => {
    loadOtps();
  }, []);

  async function loadOtps() {
    setLoading(true);
    try {
      const { data } = await adminAPI.getOtps();
      setOtps(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load OTPs');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateOtp(e) {
    e.preventDefault();
    if (!generateForm.email.trim()) { toast.error('Email is required'); return; }
    if (!generateForm.phone.trim()) { toast.error('Phone is required'); return; }

    setGeneratingOtp(true);
    try {
      const { data } = await adminAPI.generateOtp(generateForm);
      toast.success('OTP generated! Manually share with user if needed.');
      // Add new OTP to the top of the list
      setOtps(prev => [{
        id: data.data.id,
        email: data.data.email,
        phone: data.data.phone,
        otp_code: data.data.otp_code,
        otp_code_masked: `${data.data.otp_code.substring(0, 2)}****`,
        phone_masked: `${data.data.phone.substring(0, data.data.phone.length - 4)}****`,
        channel: 'admin_generated',
        expires_at: data.data.expires_at,
        expires_in_minutes: 10,
        used: false,
        attempts: 0,
      }, ...prev]);
      setGenerateForm({ email: '', phone: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate OTP');
    } finally {
      setGeneratingOtp(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  }

  return (
    <>
      <Head><title>OTP Management — SolNuv Admin</title></Head>

      <AdminRoute requiredRoles={['super_admin']}>
        <div className="page-header">
          <h1 className="font-display font-bold text-2xl text-forest-900">OTP Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">View pending password reset OTPs and manually generate codes for users</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-200 mb-6">
          {[
            { id: 'pending', label: 'Pending OTPs' },
            { id: 'generate', label: 'Generate New' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-forest-900 border-forest-900'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Pending OTPs */}
        {activeTab === 'pending' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={loadOtps} disabled={loading}
                className="text-sm text-forest-900 font-semibold flex items-center gap-2 p-2 hover:bg-forest-900/5 rounded-lg transition-colors disabled:opacity-50">
                <RiRefreshLine className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-forest-900 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 text-sm mt-3">Loading OTPs...</p>
              </div>
            ) : otps.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <p className="text-slate-500">No pending OTPs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Email</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Phone</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">OTP Code</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Channel</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Expires In</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Attempts</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otps.map(otp => (
                      <tr key={otp.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{otp.email}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500" title={otp.phone}>
                          {otp.phone_masked}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="bg-amber-50 text-amber-800 px-2 py-1 rounded font-semibold text-sm">
                              {otp.otp_code}
                            </code>
                            <button onClick={() => copyToClipboard(otp.otp_code)}
                              className="p-1.5 text-slate-400 hover:text-forest-900 hover:bg-forest-900/5 rounded transition-colors"
                              title="Copy full OTP">
                              <RiFileCopyLine />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`px-2 py-1 rounded font-medium ${
                            otp.channel === 'admin_generated'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {otp.channel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {otp.expires_in_minutes > 0 ? (
                            <span className="text-amber-600 font-semibold">{otp.expires_in_minutes}m</span>
                          ) : (
                            <span className="text-red-600">Expired</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {otp.attempts}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <button onClick={() => copyToClipboard(`Email: ${otp.email}\nPhone: ${otp.phone}\nOTP: ${otp.otp_code}`)}
                            className="text-xs px-2 py-1 bg-forest-900 text-white rounded hover:bg-forest-800 transition-colors flex items-center gap-1">
                            <RiFileCopyLine className="text-sm" /> Copy All
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Generate New OTP */}
        {activeTab === 'generate' && (
          <div className="max-w-lg">
            <div className="card">
              <h2 className="font-semibold text-forest-900 mb-4">Generate Single-Use OTP</h2>
              <p className="text-sm text-slate-600 mb-4">
                Use this to manually generate an OTP for a user if SMS delivery failed or to assist with account recovery.
              </p>

              <form onSubmit={handleGenerateOtp} className="space-y-4">
                <div>
                  <label className="label">User Email *</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="user@example.com"
                    value={generateForm.email}
                    onChange={e => setGenerateForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="label">User Phone Number *</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="+234 901 234 5678"
                    value={generateForm.phone}
                    onChange={e => setGenerateForm(f => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900">
                    💡 <strong>Tip:</strong> The generated OTP will be valid for 10 minutes. Copy it and share with the user via secure channel.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={generatingOtp}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <RiAddLine /> {generatingOtp ? 'Generating...' : 'Generate OTP'}
                </button>
              </form>
            </div>
          </div>
        )}
      </AdminRoute>
    </>
  );
}

OtpManagement.getLayout = getAdminLayout;
