import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { RiSave3Line, RiRefreshLine, RiExternalLinkLine, RiInformationLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL;

const FIELD_META = {
  site_name:               { label: 'Site Name',               type: 'text',     hint: 'Appears in browser tab and OG tags.' },
  default_title:           { label: 'Default Page Title',      type: 'text',     hint: 'Used when a page has no explicit title (≤60 chars recommended).' },
  default_description:     { label: 'Default Meta Description',type: 'textarea', hint: 'Shown in Google snippets for pages without a description (≤160 chars).' },
  default_keywords:        { label: 'Default Keywords',        type: 'text',     hint: 'Comma-separated. Less important today but useful for analytics.' },
  og_image_url:            { label: 'Default OG Image URL',    type: 'url',      hint: 'Absolute URL to the default Open Graph preview image (1200×630px).' },
  twitter_handle:          { label: 'Twitter / X Handle',      type: 'text',     hint: 'Include the @, e.g. @solnuv.' },
  canonical_base:          { label: 'Canonical Base URL',      type: 'url',      hint: 'Production domain, no trailing slash. e.g. https://solnuv.com' },
  google_site_verification:{ label: 'Google Search Console Verification', type: 'text', hint: 'Paste the content value from <meta name="google-site-verification">.' },
  google_analytics_id:     { label: 'Google Analytics ID',     type: 'text',     hint: 'GA4 Measurement ID, e.g. G-XXXXXXXXXX.' },
};

function Field({ name, meta, value, onChange }) {
  const isTextarea = meta.type === 'textarea';
  const inputClass =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm ' +
    'text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none';

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{meta.label}</label>
      {isTextarea ? (
        <textarea
          className={`${inputClass} min-h-[80px]`}
          value={value ?? ''}
          onChange={e => onChange(name, e.target.value)}
          rows={3}
        />
      ) : (
        <input
          type={meta.type === 'url' ? 'url' : 'text'}
          className={inputClass}
          value={value ?? ''}
          onChange={e => onChange(name, e.target.value)}
        />
      )}
      {meta.hint && (
        <p className="mt-1 text-xs text-slate-500 flex items-start gap-1">
          <RiInformationLine className="shrink-0 mt-0.5" />
          {meta.hint}
        </p>
      )}
    </div>
  );
}

export default function AdminSeoPage() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/seo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setSettings(json.data);
        setForm(json.data);
      } else {
        toast.error(json.message || 'Failed to load SEO settings');
      }
    } catch {
      toast.error('Could not reach server');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function handleChange(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      for (const key of Object.keys(FIELD_META)) {
        payload[key] = form[key] ?? null;
      }

      const res = await fetch(`${API}/api/admin/seo`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('SEO settings saved');
        setSettings(json.data);
      } else {
        toast.error(json.message || 'Save failed');
      }
    } catch {
      toast.error('Network error — could not save');
    } finally {
      setSaving(false);
    }
  }

  const lastUpdated = settings?.updated_at
    ? new Date(settings.updated_at).toLocaleString()
    : null;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">SEO &amp; Search Settings</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Manage default meta tags, Open Graph, and Google Search Console integration.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <RiRefreshLine className={loading ? 'animate-spin' : ''} />
            </button>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Open Google Search Console"
            >
              <RiExternalLinkLine />
            </a>
          </div>
        </div>

        {lastUpdated && (
          <p className="text-xs text-slate-500">Last updated: {lastUpdated}</p>
        )}

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-800 rounded-lg" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Core identity */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Core Identity</h2>
              {['site_name', 'default_title', 'default_description', 'default_keywords'].map(key => (
                <Field key={key} name={key} meta={FIELD_META[key]} value={form[key]} onChange={handleChange} />
              ))}
            </section>

            {/* Social & OG */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Social &amp; Open Graph</h2>
              {['og_image_url', 'twitter_handle', 'canonical_base'].map(key => (
                <Field key={key} name={key} meta={FIELD_META[key]} value={form[key]} onChange={handleChange} />
              ))}
            </section>

            {/* Google / Analytics */}
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Google Integration</h2>
              {['google_site_verification', 'google_analytics_id'].map(key => (
                <Field key={key} name={key} meta={FIELD_META[key]} value={form[key]} onChange={handleChange} />
              ))}
            </section>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <RiSave3Line />
              {saving ? 'Saving…' : 'Save SEO Settings'}
            </button>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
