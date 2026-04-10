import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import {
  RiArticleLine, RiAdvertisementLine, RiAddLine, RiEditLine, RiDeleteBinLine,
  RiCheckLine, RiCloseLine, RiEyeLine, RiMouseLine, RiBarChartLine,
  RiSaveLine, RiToggleLine, RiMegaphoneLine, RiRobotLine, RiMagicLine, RiLoader4Line
} from 'react-icons/ri';
import { useAuth } from '../../context/AuthContext';
import AdminRoute from '../../components/AdminRoute';
import { getAdminLayout } from '../../components/Layout';
import { blogAPI, agentAPI } from '../../services/api';
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
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAi, setShowAi] = useState(false);

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] };
    onSave(payload);
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a topic or instruction for the AI');
      return;
    }
    setAiGenerating(true);
    try {
      const { data } = await agentAPI.adminRunBlogWriter({
        prompt: aiPrompt.trim(),
        mode: initial ? 'edit' : 'create',
        postId: initial?.id || undefined,
      });
      const gen = data?.data?.generated;
      if (gen) {
        if (gen.title) { set('title', gen.title); if (!initial) set('slug', gen.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }
        if (gen.content) set('content', gen.content);
        if (gen.excerpt) set('excerpt', gen.excerpt);
        if (gen.category) set('category', gen.category);
        if (gen.tags) set('tags', Array.isArray(gen.tags) ? gen.tags.join(', ') : gen.tags);
        if (gen.read_time_mins) set('read_time_mins', gen.read_time_mins);
        toast.success('AI content generated — review and save');
      } else {
        toast.error('AI returned an empty response');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* AI Writer Panel */}
      <div className="border border-violet-700/40 rounded-xl overflow-hidden bg-violet-950/20">
        <button
          type="button"
          onClick={() => setShowAi(!showAi)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-violet-300 hover:bg-violet-900/20 transition-colors"
        >
          <span className="flex items-center gap-2"><RiRobotLine className="text-base" /> AI Blog Writer (SEO)</span>
          <span className="text-xs text-violet-400">{showAi ? 'Collapse' : 'Expand'}</span>
        </button>
        {showAi && (
          <div className="px-4 pb-4 space-y-3 border-t border-violet-700/30">
            <p className="text-xs text-slate-400 mt-3">
              {initial
                ? 'Describe how you want to update this post. The AI will read the existing content and apply your instructions.'
                : 'Describe the blog topic, target keywords, or specific angle. The AI will generate title, excerpt, content (HTML), category, and tags.'}
            </p>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder={initial
                ? 'e.g. "Rewrite the introduction to focus more on NESREA compliance deadlines" or "Add a section about battery recycling in Lagos"'
                : 'e.g. "Write about silver recovery from end-of-life solar panels in Nigeria — target keywords: NESREA compliance, solar panel recycling, silver value"'}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={aiGenerating}
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiPrompt.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiGenerating ? <><RiLoader4Line className="animate-spin" /> Generating...</> : <><RiMagicLine /> Generate with AI</>}
            </button>
          </div>
        )}
      </div>

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
  const [adsAnalytics, setAdsAnalytics] = useState([]);
  const [adsAnalyticsLoading, setAdsAnalyticsLoading] = useState(false);
  const [adFilters, setAdFilters] = useState({
    placement: '',
    user_type: '',
    sort_by: 'recent',
    order: 'desc',
    min_clicks: '',
    min_ctr: '',
  });

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

  const loadAdsAnalytics = useCallback(async () => {
    if (tab !== 'ads') return;
    setAdsAnalyticsLoading(true);
    try {
      const params = {
        sort_by: adFilters.sort_by,
        order: adFilters.order,
        limit: 100,
      };
      if (adFilters.placement) params.placement = adFilters.placement;
      if (adFilters.user_type) params.user_type = adFilters.user_type;
      if (adFilters.min_clicks) params.min_clicks = Number(adFilters.min_clicks);
      if (adFilters.min_ctr) params.min_ctr = Number(adFilters.min_ctr);

      const { data } = await blogAPI.adminListAdsAnalytics(params);
      setAdsAnalytics(data.data?.ads || []);
    } catch {
      toast.error('Failed to load ad analytics');
    } finally {
      setAdsAnalyticsLoading(false);
    }
  }, [adFilters, tab]);

  useEffect(() => {
    loadAdsAnalytics();
  }, [loadAdsAnalytics]);

  const analyticsByAdId = adsAnalytics.reduce((acc, item) => {
    acc[item.ad_id] = item;
    return acc;
  }, {});

  const adsById = ads.reduce((acc, ad) => {
    acc[ad.id] = ad;
    return acc;
  }, {});

  const orderedAds = adsAnalytics.length > 0
    ? adsAnalytics.map((item) => adsById[item.ad_id]).filter(Boolean)
    : ads;

  const bestPerformingAd = adsAnalytics[0] || null;

  return (
    <>
      <Head><title>Blog & Ads Management - SolNuv Admin</title></Head>

      <div className="max-w-screen-xl mx-auto">
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select className="input !py-1.5 !text-xs !h-9" value={adFilters.placement} onChange={(e) => setAdFilters((f) => ({ ...f, placement: e.target.value }))}>
                  <option value="">All placements</option>
                  {PLACEMENTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </select>
                <select className="input !py-1.5 !text-xs !h-9" value={adFilters.user_type} onChange={(e) => setAdFilters((f) => ({ ...f, user_type: e.target.value }))}>
                  <option value="">All user types</option>
                  <option value="guest">Guest</option>
                  <option value="installer">Installer</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="distributor">Distributor</option>
                  <option value="collector">Collector</option>
                  <option value="recycler">Recycler</option>
                  <option value="unknown">Unknown</option>
                </select>
                <select className="input !py-1.5 !text-xs !h-9" value={adFilters.sort_by} onChange={(e) => setAdFilters((f) => ({ ...f, sort_by: e.target.value }))}>
                  <option value="recent">Sort: Recent</option>
                  <option value="ctr">Sort: CTR</option>
                  <option value="clicks">Sort: Clicks</option>
                  <option value="impressions">Sort: Impressions</option>
                  <option value="unique_click_users">Sort: Unique Click Users</option>
                </select>
                <select className="input !py-1.5 !text-xs !h-9" value={adFilters.order} onChange={(e) => setAdFilters((f) => ({ ...f, order: e.target.value }))}>
                  <option value="desc">Order: Desc</option>
                  <option value="asc">Order: Asc</option>
                </select>
                <input className="input !py-1.5 !text-xs !h-9 max-w-[130px]" type="number" min="0" placeholder="Min clicks" value={adFilters.min_clicks} onChange={(e) => setAdFilters((f) => ({ ...f, min_clicks: e.target.value }))} />
                <input className="input !py-1.5 !text-xs !h-9 max-w-[130px]" type="number" min="0" step="0.01" placeholder="Min CTR %" value={adFilters.min_ctr} onChange={(e) => setAdFilters((f) => ({ ...f, min_ctr: e.target.value }))} />
                <button
                  type="button"
                  onClick={() => setAdFilters({ placement: '', user_type: '', sort_by: 'recent', order: 'desc', min_clicks: '', min_ctr: '' })}
                  className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
                >
                  Reset
                </button>
              </div>
              {bestPerformingAd && (
                <div className="rounded-lg border border-emerald-800/50 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300">
                  Best performing: <span className="font-semibold">{bestPerformingAd.title}</span> · CTR {bestPerformingAd.ctr}% · {bestPerformingAd.clicks} clicks
                </div>
              )}
            </div>

            {adsAnalyticsLoading && <p className="text-slate-400 text-xs">Refreshing analytics…</p>}
            {orderedAds.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">No ads match the selected filters.</p>}
            {orderedAds.map((ad) => {
              const a = analytics[`ad_${ad.id}`] || analyticsByAdId[ad.id];
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
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-amber-400"><RiEyeLine />{a.impressions} impr.</span>
                        <span className="flex items-center gap-1 text-xs text-emerald-400"><RiMouseLine />{a.clicks} clicks</span>
                        <span className="text-xs text-slate-400">CTR: {a.ctr}%</span>
                        <span className="text-xs text-slate-400">Unique users: {a.unique_click_users || 0}</span>
                        <span className="text-xs text-slate-400">Guests: {a.anonymous_clicks || 0}</span>
                        {a.clicks_by_user_type && (
                          <span className="text-xs text-slate-500">Types: {Object.entries(a.clicks_by_user_type).map(([k, v]) => `${k}:${v}`).join(' · ')}</span>
                        )}
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
