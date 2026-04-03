import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import {
  RiArticleLine, RiAdvertisementLine, RiAddLine, RiEditLine, RiDeleteBinLine,
  RiCheckLine, RiCloseLine, RiEyeLine, RiMouseLine, RiBarChartLine,
  RiSaveLine, RiToggleLine
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

const PLACEMENTS = ['sidebar', 'banner', 'in-feed', 'footer', 'blog-top', 'blog-bottom', 'popup'];

function emptyPost() {
  return { title: '', slug: '', excerpt: '', content: '', cover_image_url: '', category: '', tags: '', status: 'draft', read_time_mins: 3 };
}

function emptyAd() {
  return { title: '', image_url: '', target_url: '', body_text: '', placement: 'sidebar', priority: 0, start_date: '', end_date: '', is_active: true, max_total_views: '', max_unique_accounts: '' };
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

function AdForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || emptyAd());
  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

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
          <label className="label">Placement</label>
          <select className="input" value={form.placement} onChange={(e) => set('placement', e.target.value)}>
            {PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-amber-800/40 rounded-xl p-4 bg-amber-900/10">
          <div>
            <label className="label">Max Total Views</label>
            <p className="text-[10px] text-slate-400 mb-1">Popup stops showing after this many impressions. Leave blank for unlimited.</p>
            <input className="input" type="number" min="1" placeholder="Unlimited" value={form.max_total_views} onChange={(e) => set('max_total_views', e.target.value)} />
          </div>
          <div>
            <label className="label">Max Unique Accounts</label>
            <p className="text-[10px] text-slate-400 mb-1">Popup stops after this many distinct logged-in users see it. Leave blank for unlimited.</p>
            <input className="input" type="number" min="1" placeholder="Unlimited" value={form.max_unique_accounts} onChange={(e) => set('max_unique_accounts', e.target.value)} />
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

function BlogAdminPage() {
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postModal, setPostModal] = useState(null); // null | 'create' | post object
  const [adModal, setAdModal] = useState(null);
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

  useEffect(() => {
    if (tab === 'posts') loadPosts();
    else loadAds();
  }, [tab, loadPosts, loadAds]);

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
            onClick={() => tab === 'posts' ? setPostModal('create') : setAdModal('create')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
          >
            <RiAddLine /> {tab === 'posts' ? 'New Post' : 'New Ad'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-slate-800/50 rounded-xl w-fit">
          {[{ key: 'posts', icon: RiArticleLine, label: 'Blog Posts' }, { key: 'ads', icon: RiAdvertisementLine, label: 'Advertisements' }].map(({ key, icon: Icon, label }) => (
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
        ) : (
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
