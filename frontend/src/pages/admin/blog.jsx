import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import {
  RiArticleLine, RiAdvertisementLine, RiAddLine, RiEditLine, RiDeleteBinLine,
  RiCheckLine, RiCloseLine, RiEyeLine, RiMouseLine, RiBarChartLine,
  RiSaveLine, RiToggleLine, RiMegaphoneLine
} from 'react-icons/ri';
import { useAuth } from '../../context/AuthContext';
import AdminRoute from '../../components/AdminRoute';
import { getAdminLayout } from '../../components/Layout';
import { blogAPI } from '../../services/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  published: 'bg-emerald-900/30 text-emerald-400 border-emerald-800',
  draft: 'bg-slate-700 text-slate-300 border-slate-600',
  archived: 'bg-red-900/30 text-red-400 border-red-800',
};

const PLACEMENTS = ['sidebar', 'banner', 'in-feed', 'footer', 'inline', 'popup'];

const PLACEMENT_DESCRIPTIONS = {
  sidebar:  'Right-column vertical card',
  banner:   'Full-width horizontal strip (below hero)',
  'in-feed':'Horizontal card between list items',
  footer:   'Compact strip at bottom of page',
  inline:   'Card inserted inside article body',
  popup:    'Overlay popup (login / interval triggered)',
};

const PAGE_CONTEXTS = [
  { id: 'all',       label: 'All Pages',       desc: 'Everywhere' },
  { id: 'home',      label: 'Home',            desc: '/' },
  { id: 'blog',      label: 'Blog Listing',    desc: '/blog' },
  { id: 'blog_post', label: 'Blog Post',       desc: '/blog/[slug]' },
  { id: 'faq',       label: 'FAQ',             desc: '/faq' },
  { id: 'contact',   label: 'Contact',         desc: '/contact' },
  { id: 'dashboard', label: 'Dashboard',       desc: '/dashboard' },
  { id: 'calculator',label: 'Calculator',      desc: '/calculator' },
  { id: 'plans',     label: 'Plans & Pricing', desc: '/plans' },
];

function emptyPost() {
  return { title: '', slug: '', excerpt: '', content: '', cover_image_url: '', category: '', tags: '', status: 'draft', read_time_mins: 3 };
}

function emptyAd() {
  return { title: '', image_url: '', target_url: '', body_text: '', placement: 'sidebar', priority: 0, start_date: '', end_date: '', is_active: true, max_total_views: '', max_unique_accounts: '', campaign_id: '', display_order: 0, page_contexts: ['all'] };
}

function emptyCampaign() {
  return { title: '', is_active: true, show_on_login: true, show_on_interval: false, interval_minutes: '' };
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-display font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><RiCloseLine className="text-xl" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function PostForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || emptyPost());

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] };
    onSave(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Title *</label>
          <input className="input" value={form.title} onChange={(e) => { set('title', e.target.value); if (!initial) set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} required />
        </div>
        <div>
          <label className="label">Slug *</label>
          <input className="input font-mono text-xs" value={form.slug} onChange={(e) => set('slug', e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="label">Excerpt</label>
        <textarea className="input resize-none" rows={2} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} />
      </div>
      <div>
        <label className="label">Content (HTML) *</label>
        <textarea className="input font-mono text-xs resize-y" rows={10} value={form.content} onChange={(e) => set('content', e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Cover Image URL</label>
          <input className="input" type="url" value={form.cover_image_url} onChange={(e) => set('cover_image_url', e.target.value)} />
        </div>
        <div>
          <label className="label">Category</label>
          <input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input className="input" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
        </div>
        <div>
          <label className="label">Read Time (mins)</label>
          <input className="input" type="number" min={1} value={form.read_time_mins} onChange={(e) => set('read_time_mins', Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          <RiSaveLine /> {saving ? 'Saving…' : 'Save Post'}
        </button>
      </div>
    </form>
  );
}

function AdForm({ initial, onSave, onCancel, saving, campaigns = [] }) {
  const [form, setForm] = useState(initial ? { ...initial, page_contexts: initial.page_contexts || ['all'] } : emptyAd());
  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  function toggleContext(id) {
    const isAll = id === 'all';
    const cur = form.page_contexts || ['all'];
    if (isAll) {
      set('page_contexts', cur.includes('all') ? [] : ['all']);
    } else {
      const next = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur.filter((c) => c !== 'all'), id];
      set('page_contexts', next.length ? next : ['all']);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div>
        <label className="label">Ad Title *</label>
        <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Image URL</label>
          <input className="input" type="url" value={form.image_url} onChange={(e) => set('image_url', e.target.value)} />
        </div>
        <div>
          <label className="label">Target URL</label>
          <input className="input" type="url" value={form.target_url} onChange={(e) => set('target_url', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Body Text</label>
        <textarea className="input resize-none" rows={2} value={form.body_text} onChange={(e) => set('body_text', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Placement Slot</label>
          <select className="input" value={form.placement} onChange={(e) => set('placement', e.target.value)}>
            {PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {PLACEMENT_DESCRIPTIONS[form.placement] && (
            <p className="text-[10px] text-slate-400 mt-1">{PLACEMENT_DESCRIPTIONS[form.placement]}</p>
          )}
        </div>
        <div>
          <label className="label">Priority (higher = first)</label>
          <input className="input" type="number" value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Active</label>
          <select className="input" value={form.is_active ? 'true' : 'false'} onChange={(e) => set('is_active', e.target.value === 'true')}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      {/* Page targeting */}
      <div className="border border-slate-700 rounded-xl p-4 space-y-3 bg-slate-800/40">
        <div>
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-0.5">Page Targets</p>
          <p className="text-[10px] text-slate-500">Select which pages/sections this ad slot appears on. &ldquo;All Pages&rdquo; overrides all other selections.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PAGE_CONTEXTS.map(({ id, label, desc }) => {
            const allSelected = (form.page_contexts || []).includes('all');
            const checked = (form.page_contexts || []).includes(id);
            const disabled = id !== 'all' && allSelected;
            return (
              <label key={id} className={`flex items-start gap-2 cursor-pointer rounded-lg px-2.5 py-2 border transition-colors ${checked ? 'border-emerald-700 bg-emerald-900/20' : 'border-slate-700 hover:border-slate-500'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleContext(id)}
                  className="mt-0.5 accent-emerald-500 flex-shrink-0"
                />
                <div>
                  <p className="text-xs font-medium text-slate-200 leading-tight">{label}</p>
                  <p className="text-[10px] text-slate-500">{desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Start Date</label>
          <input className="input" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className="label">End Date</label>
          <input className="input" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
        </div>
      </div>
      {form.placement === 'popup' && (
        <div className="space-y-4 border border-amber-800/40 rounded-xl p-4 bg-amber-900/10">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Popup Settings</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Max Total Views</label>
              <p className="text-[10px] text-slate-400 mb-1">Stop after this many impressions. Blank = unlimited.</p>
              <input className="input" type="number" min="1" placeholder="Unlimited" value={form.max_total_views} onChange={(e) => set('max_total_views', e.target.value)} />
            </div>
            <div>
              <label className="label">Max Unique Accounts</label>
              <p className="text-[10px] text-slate-400 mb-1">Stop after this many distinct users. Blank = unlimited.</p>
              <input className="input" type="number" min="1" placeholder="Unlimited" value={form.max_unique_accounts} onChange={(e) => set('max_unique_accounts', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Campaign</label>
              <select className="input" value={form.campaign_id} onChange={(e) => set('campaign_id', e.target.value)}>
                <option value="">— None (standalone) —</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Display Order in Campaign</label>
              <input className="input" type="number" min="0" value={form.display_order} onChange={(e) => set('display_order', Number(e.target.value))} />
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          <RiSaveLine /> {saving ? 'Saving…' : 'Save Ad'}
        </button>
      </div>
    </form>
  );
}

function CampaignForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || emptyCampaign());
  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div>
        <label className="label">Campaign Title *</label>
        <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} required placeholder="e.g. Rainy Season Promo" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.is_active ? 'true' : 'false'} onChange={(e) => set('is_active', e.target.value === 'true')}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      <div className="border border-slate-700 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Display Triggers</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.show_on_login} onChange={(e) => set('show_on_login', e.target.checked)} className="mt-0.5 accent-emerald-500" />
          <div>
            <p className="text-sm font-medium text-slate-200">Show on Login</p>
            <p className="text-xs text-slate-400">Display once per session when the user logs in</p>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.show_on_interval} onChange={(e) => set('show_on_interval', e.target.checked)} className="mt-0.5 accent-emerald-500" />
          <div>
            <p className="text-sm font-medium text-slate-200">Show on Interval</p>
            <p className="text-xs text-slate-400">Reappear every N minutes while the user is active</p>
          </div>
        </label>
        {form.show_on_interval && (
          <div>
            <label className="label">Interval (minutes)</label>
            <input className="input" type="number" min="1" placeholder="e.g. 60" value={form.interval_minutes} onChange={(e) => set('interval_minutes', e.target.value)} />
          </div>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          <RiSaveLine /> {saving ? 'Saving…' : 'Save Campaign'}
        </button>
      </div>
    </form>
  );
}

function BlogAdminPage() {
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [ads, setAds] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postModal, setPostModal] = useState(null);
  const [adModal, setAdModal] = useState(null);
  const [campaignModal, setCampaignModal] = useState(null); // null | 'create' | campaign obj
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState({});

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await blogAPI.adminListPosts({ limit: 50 });
      setPosts(data.data || []);
    } catch { toast.error('Failed to load posts'); }
    finally { setLoading(false); }
  }, []);

  const loadAds = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await blogAPI.adminListAds();
      setAds(data.data || []);
    } catch { toast.error('Failed to load ads'); }
    finally { setLoading(false); }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await blogAPI.adminListCampaigns();
      setCampaigns(data.data || []);
    } catch { toast.error('Failed to load campaigns'); }
    finally { setLoading(false); }
  }, []);

  // Also keep campaigns list fresh for AdForm dropdown
  useEffect(() => {
    blogAPI.adminListCampaigns().then((r) => setCampaigns(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'posts') loadPosts();
    else if (tab === 'ads') loadAds();
    else loadCampaigns();
  }, [tab, loadPosts, loadAds, loadCampaigns]);

  async function savePost(form) {
    setSaving(true);
    try {
      if (postModal === 'create') {
        await blogAPI.adminCreatePost(form);
        toast.success('Post created');
      } else {
        await blogAPI.adminUpdatePost(postModal.id, form);
        toast.success('Post updated');
      }
      setPostModal(null);
      loadPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save post');
    } finally { setSaving(false); }
  }

  async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    try {
      await blogAPI.adminDeletePost(id);
      toast.success('Post deleted');
      loadPosts();
    } catch { toast.error('Failed to delete post'); }
  }

  async function saveAd(form) {
    setSaving(true);
    try {
      if (adModal === 'create') {
        await blogAPI.adminCreateAd(form);
        toast.success('Ad created');
      } else {
        await blogAPI.adminUpdateAd(adModal.id, form);
        toast.success('Ad updated');
      }
      setAdModal(null);
      loadAds();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save ad');
    } finally { setSaving(false); }
  }

  async function deleteAd(id) {
    if (!confirm('Delete this ad?')) return;
    try {
      await blogAPI.adminDeleteAd(id);
      toast.success('Ad deleted');
      loadAds();
    } catch { toast.error('Failed to delete ad'); }
  }

  async function saveCampaign(form) {
    setSaving(true);
    try {
      if (campaignModal === 'create') {
        await blogAPI.adminCreateCampaign(form);
        toast.success('Campaign created');
      } else {
        await blogAPI.adminUpdateCampaign(campaignModal.id, form);
        toast.success('Campaign updated');
      }
      setCampaignModal(null);
      loadCampaigns();
      blogAPI.adminListCampaigns().then((r) => setCampaigns(r.data.data || [])).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save campaign');
    } finally { setSaving(false); }
  }

  async function deleteCampaign(id) {
    if (!confirm('Delete this campaign? Ads inside will be unlinked but not deleted.')) return;
    try {
      await blogAPI.adminDeleteCampaign(id);
      toast.success('Campaign deleted');
      loadCampaigns();
    } catch { toast.error('Failed to delete campaign'); }
  }

  async function loadPostAnalytics(id) {
    try {
      const { data } = await blogAPI.adminGetPostAnalytics(id);
      setAnalytics((a) => ({ ...a, [id]: data.data }));
    } catch {}
  }

  async function loadAdAnalytics(id) {
    try {
      const { data } = await blogAPI.adminGetAdAnalytics(id);
      setAnalytics((a) => ({ ...a, [`ad_${id}`]: data.data }));
    } catch {}
  }

  return (
    <>
      <Head><title>Blog & Ads Management - SolNuv Admin</title></Head>

      <style jsx global>{`
        .label { display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .input { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #334155; background: #1e293b; color: #f1f5f9; font-size: 0.875rem; outline: none; }
        .input:focus { ring: 2px solid #10b981; border-color: #10b981; }
      `}</style>

      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Blog &amp; Ads</h1>
            <p className="text-sm text-slate-400">Create and manage blog posts and advertisements</p>
          </div>
          <button
            onClick={() => {
              if (tab === 'posts') setPostModal('create');
              else if (tab === 'ads') setAdModal('create');
              else setCampaignModal('create');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
          >
            <RiAddLine /> {tab === 'posts' ? 'New Post' : tab === 'ads' ? 'New Ad' : 'New Campaign'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-slate-800/50 rounded-xl w-fit">
          {[
            { key: 'posts', icon: RiArticleLine, label: 'Blog Posts' },
            { key: 'ads', icon: RiAdvertisementLine, label: 'Advertisements' },
            { key: 'campaigns', icon: RiMegaphoneLine, label: 'Popup Campaigns' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse" />)}</div>
        ) : tab === 'posts' ? (
          <div className="space-y-3">
            {posts.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">No posts yet. Create your first post.</p>}
            {posts.map((post) => {
              const a = analytics[post.id];
              return (
                <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
                  {post.cover_image_url && (
                    <img src={post.cover_image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-100 truncate">{post.title}</p>
                    <p className="text-xs text-slate-400 font-mono truncate">/blog/{post.slug}</p>
                    {a && (
                      <div className="flex gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-emerald-400"><RiEyeLine />{a.reads} reads</span>
                        <span className="flex items-center gap-1 text-xs text-violet-400"><RiMouseLine />{a.link_clicks} clicks</span>
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[post.status]}`}>{post.status}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { if (!analytics[post.id]) loadPostAnalytics(post.id); else setAnalytics((a) => { const n = {...a}; delete n[post.id]; return n; }); }} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors" title="Analytics">
                      <RiBarChartLine />
                    </button>
                    <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors" title="Preview">
                      <RiEyeLine />
                    </a>
                    <button onClick={() => setPostModal(post)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Edit">
                      <RiEditLine />
                    </button>
                    <button onClick={() => deletePost(post.id)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors" title="Delete">
                      <RiDeleteBinLine />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : tab === 'ads' ? (
          <div className="space-y-3">
            {ads.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">No ads yet. Create your first ad.</p>}
            {ads.map((ad) => {
              const a = analytics[`ad_${ad.id}`];
              return (
                <div key={ad.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
                  {ad.image_url && (
                    <img src={ad.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-100 truncate">{ad.title}</p>
                    <p className="text-xs text-slate-400 truncate">{ad.placement} · priority {ad.priority}</p>
                    {ad.page_contexts && ad.page_contexts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ad.page_contexts.map((ctx) => (
                          <span key={ctx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">{ctx}</span>
                        ))}
                      </div>
                    )}
                    {a && (
                      <div className="flex gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-amber-400"><RiEyeLine />{a.impressions} impr.</span>
                        <span className="flex items-center gap-1 text-xs text-emerald-400"><RiMouseLine />{a.clicks} clicks</span>
                        <span className="text-xs text-slate-400">CTR: {a.ctr}%</span>
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${ad.is_active ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    {ad.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { if (!analytics[`ad_${ad.id}`]) loadAdAnalytics(ad.id); else setAnalytics((a) => { const n = {...a}; delete n[`ad_${ad.id}`]; return n; }); }} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors" title="Analytics">
                      <RiBarChartLine />
                    </button>
                    <button onClick={() => setAdModal(ad)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Edit">
                      <RiEditLine />
                    </button>
                    <button onClick={() => deleteAd(ad.id)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors" title="Delete">
                      <RiDeleteBinLine />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Campaigns tab */
          <div className="space-y-3">
            {campaigns.length === 0 && (
              <p className="text-slate-400 text-sm py-8 text-center">No campaigns yet. Create your first popup campaign.</p>
            )}
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-100">{campaign.title}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {campaign.show_on_login && (
                        <span className="text-xs bg-blue-900/30 text-blue-400 border border-blue-800 px-2 py-0.5 rounded-full">On Login</span>
                      )}
                      {campaign.show_on_interval && (
                        <span className="text-xs bg-purple-900/30 text-purple-400 border border-purple-800 px-2 py-0.5 rounded-full">
                          Every {campaign.interval_minutes}min
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{campaign.ads?.length || 0} ad(s)</span>
                    </div>
                    {campaign.ads?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {campaign.ads.map((ad) => (
                          <div key={ad.id} className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2 py-1">
                            {ad.image_url && (
                              <img src={ad.image_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                            )}
                            <span className="text-xs text-slate-300 truncate max-w-[120px]">{ad.title}</span>
                            <span className="text-[10px] text-slate-500">#{ad.display_order}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${campaign.is_active ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    {campaign.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCampaignModal(campaign)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Edit">
                      <RiEditLine />
                    </button>
                    <button onClick={() => deleteCampaign(campaign.id)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors" title="Delete">
                      <RiDeleteBinLine />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Post modal */}
      {postModal !== null && (
        <Modal title={postModal === 'create' ? 'New Blog Post' : 'Edit Post'} onClose={() => setPostModal(null)}>
          <PostForm
            initial={postModal !== 'create' ? { ...postModal, tags: (postModal.tags || []).join(', ') } : undefined}
            onSave={savePost}
            onCancel={() => setPostModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {/* Ad modal */}
      {adModal !== null && (
        <Modal title={adModal === 'create' ? 'New Advertisement' : 'Edit Ad'} onClose={() => setAdModal(null)}>
          <AdForm
            initial={adModal !== 'create' ? adModal : undefined}
            onSave={saveAd}
            onCancel={() => setAdModal(null)}
            saving={saving}
            campaigns={campaigns}
          />
        </Modal>
      )}

      {/* Campaign modal */}
      {campaignModal !== null && (
        <Modal title={campaignModal === 'create' ? 'New Popup Campaign' : 'Edit Campaign'} onClose={() => setCampaignModal(null)}>
          <CampaignForm
            initial={campaignModal !== 'create' ? campaignModal : undefined}
            onSave={saveCampaign}
            onCancel={() => setCampaignModal(null)}
            saving={saving}
          />
        </Modal>
      )}
    </>
  );
}

BlogAdminPage.getLayout = getAdminLayout;

export default function BlogAdminPageWrapper() {
  return (
    <AdminRoute>
      <BlogAdminPage />
    </AdminRoute>
  );
}

BlogAdminPageWrapper.getLayout = getAdminLayout;
