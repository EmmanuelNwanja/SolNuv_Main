import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { supabase } from '../../utils/supabase';
import { getDashboardLayout } from '../../components/Layout';
import { MotionSection } from '../../components/PageMotion';
import { LoadingSpinner } from '../../components/ui/index';
import { RiUserLine, RiBuildingLine, RiTeamLine, RiShieldCheckLine, RiLinksLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function Settings() {
  const { profile, company, isPro, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  const [profileForm, setProfileForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || '',
    brand_name: profile?.brand_name || '',
  });

  const [companyForm, setCompanyForm] = useState({
    nesrea_registration_number: company?.nesrea_registration_number || '',
    address: company?.address || '',
    state: company?.state || '',
    city: company?.city || '',
    website: company?.website || '',
    logo_url: company?.logo_url || '',
    branding_primary_color: company?.branding_primary_color || '#0D3B2E',
    company_signature_url: company?.company_signature_url || '',
  });

  const [preferences, setPreferences] = useState({
    sms: profile?.notification_preferences?.sms !== false,
    whatsapp: profile?.notification_preferences?.whatsapp !== false,
    push: profile?.notification_preferences?.push !== false,
    email: profile?.notification_preferences?.email === true,
  });

  const [accountForm, setAccountForm] = useState({
    signature_url: profile?.signature_url || '',
    public_slug: profile?.public_slug || '',
    public_bio: profile?.public_bio || '',
    is_public_profile: profile?.is_public_profile !== false,
  });

  const [inviteForm, setInviteForm] = useState({ email: '', phone: '', role: 'manager', invite_channel: 'sms' });
  const [team, setTeam] = useState(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const [upgradeForm, setUpgradeForm] = useState({
    company_name: '',
    company_email: '',
    company_state: '',
    company_city: '',
    company_address: '',
  });

  useEffect(() => {
    setProfileForm({
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      phone: profile?.phone || '',
      brand_name: profile?.brand_name || '',
    });

    setCompanyForm({
      nesrea_registration_number: company?.nesrea_registration_number || '',
      address: company?.address || '',
      state: company?.state || '',
      city: company?.city || '',
      website: company?.website || '',
      logo_url: company?.logo_url || '',
      branding_primary_color: company?.branding_primary_color || '#0D3B2E',
      company_signature_url: company?.company_signature_url || '',
    });

    setPreferences({
      sms: profile?.notification_preferences?.sms !== false,
      whatsapp: profile?.notification_preferences?.whatsapp !== false,
      push: profile?.notification_preferences?.push !== false,
      email: profile?.notification_preferences?.email === true,
    });

    setAccountForm({
      signature_url: profile?.signature_url || '',
      public_slug: profile?.public_slug || '',
      public_bio: profile?.public_bio || '',
      is_public_profile: profile?.is_public_profile !== false,
    });
  }, [profile, company]);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await authAPI.saveProfile({ ...profileForm, user_type: profile.user_type, business_type: profile.business_type });
      await refreshProfile();
      toast.success('Profile saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    const newPassword = e.target.new_password.value;
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else { toast.success('Password updated!'); e.target.reset(); }
    setSaving(false);
  }

  async function loadTeam() {
    setLoadingTeam(true);
    try {
      const { data } = await authAPI.getTeam();
      setTeam(data.data);
    } catch { toast.error('Failed to load team'); }
    finally { setLoadingTeam(false); }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await authAPI.inviteMember(inviteForm);
      toast.success(`Invitation sent to ${inviteForm.email}!`);
      setInviteForm({ email: '', phone: '', role: 'manager', invite_channel: 'sms' });
      loadTeam();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invitation');
    } finally { setSaving(false); }
  }

  async function handleUpgradeToCompany(e) {
    e.preventDefault();
    if (!upgradeForm.company_name.trim()) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      await authAPI.saveProfile({
        ...profileForm,
        user_type: profile.user_type,
        business_type: 'registered',
        company_name: upgradeForm.company_name,
        company_email: upgradeForm.company_email,
        company_state: upgradeForm.company_state,
        company_city: upgradeForm.company_city,
        company_address: upgradeForm.company_address,
      });
      await refreshProfile();
      toast.success('Account upgraded! Company features are now unlocked.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upgrade account');
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: RiUserLine },
    { id: 'company', label: 'Company', icon: RiBuildingLine, show: !!company },
    { id: 'team', label: 'Team', icon: RiTeamLine, show: !!company },
    { id: 'notifications', label: 'Notifications', icon: RiLinksLine },
    { id: 'branding', label: 'Branding', icon: RiBuildingLine, show: !!company },
    { id: 'account', label: 'Account', icon: RiUserLine },
    { id: 'security', label: 'Security', icon: RiShieldCheckLine },
  ].filter(t => t.show !== false);

  return (
    <>
      <Head><title>Settings — SolNuv</title></Head>

      <MotionSection className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-forest-900 text-white px-8 py-10 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(245,158,11,0.10),transparent_70%)]" />
        <div className="relative">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3 block">Account Settings</span>
          <h1 className="font-display font-bold text-3xl">Settings</h1>
          <p className="text-white/70 text-sm mt-2">Manage your account, company, and notification preferences</p>
        </div>
      </MotionSection>

      <div className="max-w-2xl">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'team' && !team) loadTeam(); }}
              className={`flex items-center gap-2 flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white shadow-sm text-forest-900' : 'text-slate-500 hover:text-slate-700'}`}>
              <tab.icon className="text-sm" /> <span className="hidden sm:block">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSave} className="card space-y-4">
            <h2 className="font-semibold text-forest-900 mb-2">Personal Information</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <input className="input" value={profileForm.first_name} onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input className="input" value={profileForm.last_name} onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} placeholder="+234 801 234 5678" />
            </div>
            {profile?.business_type === 'solo' && (
              <div>
                <label className="label">Brand / Business Name</label>
                <input className="input" value={profileForm.brand_name} onChange={e => setProfileForm(f => ({ ...f, brand_name: e.target.value }))} />
              </div>
            )}
            <div className="pt-2">
              <label className="label">Email Address</label>
              <div className="input bg-slate-50 text-slate-500 cursor-not-allowed">{profile?.email}</div>
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed here. Contact support if needed.</p>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        )}

        {/* Upgrade to Company Account — solo users only */}
        {activeTab === 'profile' && profile?.business_type === 'solo' && (
          <form onSubmit={handleUpgradeToCompany} className="card space-y-4 mt-4 border-2 border-dashed border-emerald-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <RiBuildingLine className="text-emerald-700" />
              </div>
              <div>
                <h2 className="font-semibold text-forest-900">Upgrade to Company Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">You registered as a solo engineer. If your business is now CAC-registered, enter your company details to unlock team management, compliance reports, and branding.</p>
              </div>
            </div>
            <div>
              <label className="label">Company Name <span className="text-red-500">*</span></label>
              <input className="input" required value={upgradeForm.company_name}
                onChange={e => setUpgradeForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="Bright Solar Engineering Ltd." />
            </div>
            <div>
              <label className="label">Company Email</label>
              <input className="input" type="email" value={upgradeForm.company_email}
                onChange={e => setUpgradeForm(f => ({ ...f, company_email: e.target.value }))}
                placeholder="hello@yourcompany.com" />
              <p className="text-xs text-slate-400 mt-1">Leave blank to use your personal email.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">City</label>
                <input className="input" value={upgradeForm.company_city}
                  onChange={e => setUpgradeForm(f => ({ ...f, company_city: e.target.value }))} />
              </div>
              <div>
                <label className="label">State</label>
                <select className="input" value={upgradeForm.company_state}
                  onChange={e => setUpgradeForm(f => ({ ...f, company_state: e.target.value }))}>
                  <option value="">— Select State —</option>
                  {['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={upgradeForm.company_address}
                onChange={e => setUpgradeForm(f => ({ ...f, company_address: e.target.value }))} />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Upgrading...' : 'Upgrade to Company Account →'}
            </button>
          </form>
        )}

        {/* Company Tab */}
        {activeTab === 'company' && company && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-forest-900 mb-2">Company Details</h2>
            <div>
              <label className="label">Company Name</label>
              <div className="input bg-slate-50 text-slate-500">{company.name}</div>
              <p className="text-xs text-slate-400 mt-1">Contact support to update company name.</p>
            </div>
            <div>
              <label className="label">NESREA Registration Number</label>
              <input className="input" value={companyForm.nesrea_registration_number}
                onChange={e => setCompanyForm(f => ({ ...f, nesrea_registration_number: e.target.value }))}
                placeholder="e.g. NESREA/EPR/2024/0001"
              />
              <p className="text-xs text-slate-400 mt-1">Required to appear on EPR compliance reports.</p>
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={companyForm.city} onChange={e => setCompanyForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="label">State</label>
              <select className="input" value={companyForm.state} onChange={e => setCompanyForm(f => ({ ...f, state: e.target.value }))}>
                <option value="">— Select State —</option>
                {['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Website</label>
              <input className="input" value={companyForm.website} onChange={e => setCompanyForm(f => ({ ...f, website: e.target.value }))} placeholder="https://yourcompany.com" />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={companyForm.address} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between pt-2 p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-slate-700">Current Plan</p>
                <p className="text-xs text-slate-500">
                  {company.subscription_plan?.toUpperCase()} ({company.subscription_interval || 'monthly'})
                  {' '}• {company.max_team_members} team member{company.max_team_members !== 1 ? 's' : ''}
                </p>
                {company.subscription_expires_at && (
                  <p className="text-xs text-slate-400 mt-1">
                    Renews on {new Date(company.subscription_expires_at).toLocaleDateString('en-NG')} ({company.subscription_auto_renew === false ? 'auto-renew off' : 'auto-renew on'})
                  </p>
                )}
              </div>
              <a href="/plans" className="btn-amber text-sm px-4 py-2 rounded-xl">Upgrade</a>
            </div>
            <button disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                await authAPI.saveProfile({
                  ...profileForm,
                  user_type: profile.user_type,
                  business_type: profile.business_type,
                  company_name: company.name,
                  company_address: companyForm.address,
                  company_state: companyForm.state,
                  company_city: companyForm.city,
                  nesrea_registration_number: companyForm.nesrea_registration_number,
                  website: companyForm.website,
                  logo_url: companyForm.logo_url,
                  company_signature_url: companyForm.company_signature_url,
                  branding_primary_color: companyForm.branding_primary_color,
                });
                await refreshProfile();
                toast.success('Company details saved!');
              } catch { toast.error('Failed to save'); }
              finally { setSaving(false); }
            }} className="btn-primary">
              {saving ? 'Saving...' : 'Save Company Details'}
            </button>
          </div>
        )}

        {activeTab === 'branding' && company && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-forest-900 mb-2">Branding & Signature</h2>
            <div>
              <label className="label">Company Logo URL</label>
              <input className="input" value={companyForm.logo_url} onChange={e => setCompanyForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label className="label">Primary Brand Color</label>
              <input className="input" value={companyForm.branding_primary_color} onChange={e => setCompanyForm(f => ({ ...f, branding_primary_color: e.target.value }))} placeholder="#0D3B2E" />
            </div>
            <div>
              <label className="label">Company Signature URL</label>
              <input className="input" value={companyForm.company_signature_url} onChange={e => setCompanyForm(f => ({ ...f, company_signature_url: e.target.value }))} placeholder="https://..." />
            </div>
            <button disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                await authAPI.saveProfile({
                  ...profileForm,
                  ...companyForm,
                  user_type: profile.user_type,
                  business_type: profile.business_type,
                  company_name: company.name,
                });
                await refreshProfile();
                toast.success('Branding saved');
              } catch {
                toast.error('Failed to save branding');
              } finally {
                setSaving(false);
              }
            }} className="btn-primary">
              {saving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-forest-900 mb-2">Notification Options</h2>
            {[
              { key: 'sms', label: 'SMS alerts via Termii' },
              { key: 'whatsapp', label: 'WhatsApp alerts via Termii' },
              { key: 'push', label: 'In-app notifications' },
              { key: 'email', label: 'Email notifications' },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-700">{item.label}</span>
                <input
                  type="checkbox"
                  checked={preferences[item.key]}
                  onChange={(e) => setPreferences((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                />
              </label>
            ))}
            <button onClick={async () => {
              setSaving(true);
              try {
                await authAPI.saveProfile({
                  ...profileForm,
                  user_type: profile.user_type,
                  business_type: profile.business_type,
                  notification_preferences: preferences,
                });
                await refreshProfile();
                toast.success('Notification preferences saved');
              } catch {
                toast.error('Failed to save preferences');
              } finally {
                setSaving(false);
              }
            }} className="btn-primary">
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-forest-900 mb-2">Account Management</h2>
            <div>
              <label className="label">Personal Signature URL</label>
              <input className="input" value={accountForm.signature_url} onChange={e => setAccountForm(f => ({ ...f, signature_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label className="label">Public Portfolio Slug</label>
              {isPro ? (
                <input className="input" value={accountForm.public_slug} onChange={e => setAccountForm(f => ({ ...f, public_slug: e.target.value }))} placeholder="your-brand" />
              ) : (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">🔒 Custom Portfolio — Pro Feature</p>
                  <p className="text-xs text-amber-600 mb-2">Set a public slug to share your portfolio page with clients and investors.</p>
                  <a href="/plans" className="text-xs font-semibold text-forest-900 hover:underline">Upgrade to Pro →</a>
                </div>
              )}
            </div>
            <div>
              <label className="label">Public Bio</label>
              <textarea className="input min-h-[90px]" value={accountForm.public_bio} onChange={e => setAccountForm(f => ({ ...f, public_bio: e.target.value }))} placeholder="Short brand reputation summary" />
            </div>
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="text-sm text-slate-700">Public profile visible</span>
              <input type="checkbox" checked={accountForm.is_public_profile} onChange={e => setAccountForm(f => ({ ...f, is_public_profile: e.target.checked }))} />
            </label>
            {accountForm.public_slug && (
              <a href={`/profile/${encodeURIComponent(accountForm.public_slug)}`} target="_blank" rel="noreferrer" className="text-sm text-forest-900 font-semibold hover:underline inline-flex items-center gap-1">
                <RiLinksLine /> Preview public portfolio
              </a>
            )}
            <button onClick={async () => {
              setSaving(true);
              try {
                await authAPI.saveProfile({
                  ...profileForm,
                  user_type: profile.user_type,
                  business_type: profile.business_type,
                  ...accountForm,
                });
                await refreshProfile();
                toast.success('Account settings saved');
              } catch {
                toast.error('Failed to save account settings');
              } finally {
                setSaving(false);
              }
            }} className="btn-primary">
              {saving ? 'Saving...' : 'Save Account Settings'}
            </button>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && company && (
          <div className="space-y-4">
            {['super_admin', 'admin'].includes(profile?.role) && (
              <div className="card">
                <h2 className="font-semibold text-forest-900 mb-4">Invite Team Member</h2>
                <form onSubmit={handleInvite} className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <label className="label">Email Address</label>
                    <input className="input" type="email" placeholder="colleague@company.com" value={inviteForm.email}
                      onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Phone (optional, Termii SMS/WhatsApp)</label>
                    <input className="input" type="tel" placeholder="+234..." value={inviteForm.phone}
                      onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <select className="input" value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Invite Channel</label>
                    <select className="input" value={inviteForm.invite_channel} onChange={e => setInviteForm(f => ({ ...f, invite_channel: e.target.value }))}>
                      <option value="sms">SMS</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <button type="submit" disabled={saving} className="btn-primary">
                      {saving ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </form>
              </div>
            )}
            <div className="card">
              <h2 className="font-semibold text-forest-900 mb-4">Team Members</h2>
              {loadingTeam ? (
                <div className="flex justify-center py-4"><LoadingSpinner /></div>
              ) : !team ? (
                <p className="text-sm text-slate-400">Loading team...</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {team.members?.map(member => (
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                        <div className="w-8 h-8 bg-forest-900 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {member.first_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{member.first_name} {member.last_name}</p>
                          <p className="text-xs text-slate-400">{member.email}</p>
                        </div>
                        <span className="badge badge-slate capitalize">{member.role?.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                  {team.pending_invitations?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-500 mb-2">PENDING INVITATIONS</p>
                      {team.pending_invitations.map((inv, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 mb-2">
                          <div className="flex-1">
                            <p className="text-sm text-slate-700">{inv.email}</p>
                            <p className="text-xs text-slate-400">Invited as {inv.role} · Expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                          </div>
                          <span className="badge badge-amber">Pending</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordChange} className="card space-y-4">
            <h2 className="font-semibold text-forest-900 mb-2">Change Password</h2>
            <div>
              <label className="label">New Password</label>
              <input name="new_password" type="password" className="input" placeholder="Minimum 8 characters" minLength={8} required />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input name="confirm_password" type="password" className="input" placeholder="Repeat new password" required />
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

Settings.getLayout = getDashboardLayout;
