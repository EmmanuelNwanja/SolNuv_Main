import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import {
  RiQuestionLine, RiAddLine, RiEditLine, RiDeleteBinLine,
  RiCloseLine, RiSaveLine, RiToggleLine, RiArrowUpLine, RiArrowDownLine,
  RiArticleLine,
} from 'react-icons/ri';
import { useAuth } from '../../context/AuthContext';
import AdminRoute from '../../components/AdminRoute';
import { getAdminLayout } from '../../components/Layout';
import { faqAPI } from '../../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['General', 'Plans & Pricing', 'Calculators', 'Reports', 'Account', 'Solar Engineering', 'Billing', 'Technical'];

function emptyFaq() {
  return {
    question: '',
    answer: '',
    category: 'General',
    order_index: 0,
    is_published: false,
    blog_post_slug: '',
    blog_post_label: '',
  };
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-display font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <RiCloseLine className="text-xl" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FaqForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || emptyFaq());

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...form,
      order_index: Number(form.order_index) || 0,
      blog_post_slug: form.blog_post_slug || null,
      blog_post_label: form.blog_post_label || null,
    });
  }

  const labelClass = 'block text-xs font-semibold text-slate-400 mb-1';
  const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Question *</label>
        <input
          required
          className={inputClass}
          placeholder="Enter the question"
          value={form.question}
          onChange={(e) => set('question', e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Answer *</label>
        <textarea
          required
          rows={5}
          className={inputClass}
          placeholder="Write a clear, helpful answer…"
          value={form.answer}
          onChange={(e) => set('answer', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Category *</label>
          <select
            className={inputClass}
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Display Order</label>
          <input
            type="number"
            min="0"
            className={inputClass}
            value={form.order_index}
            onChange={(e) => set('order_index', e.target.value)}
          />
        </div>
      </div>

      <div className="border border-slate-700 rounded-xl p-4 space-y-3 bg-slate-800/40">
        <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
          <RiArticleLine /> Link to Blog Post (optional)
        </p>
        <div>
          <label className={labelClass}>Blog Post Slug</label>
          <input
            className={inputClass}
            placeholder="e.g. understanding-solar-irradiance"
            value={form.blog_post_slug}
            onChange={(e) => set('blog_post_slug', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Link Label</label>
          <input
            className={inputClass}
            placeholder="e.g. Read: Understanding Solar Irradiance"
            value={form.blog_post_label}
            onChange={(e) => set('blog_post_label', e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => set('is_published', !form.is_published)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_published ? 'bg-forest-500' : 'bg-slate-600'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_published ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm text-slate-300">{form.is_published ? 'Published' : 'Draft'}</span>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-semibold bg-forest-600 hover:bg-forest-700 text-white disabled:opacity-60 transition-colors flex items-center gap-2"
        >
          <RiSaveLine />
          {saving ? 'Saving…' : 'Save FAQ'}
        </button>
      </div>
    </form>
  );
}

const STATUS_COLORS = {
  true: 'bg-emerald-900/30 text-emerald-400 border-emerald-800',
  false: 'bg-slate-700 text-slate-300 border-slate-600',
};

function FaqAdminPage() {
  const { isPlatformAdmin, platformAdminRole } = useAuth();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'create' | 'edit', faq?: object }
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPublished, setFilterPublished] = useState('all');

  const canEdit = ['super_admin', 'operations'].includes(platformAdminRole);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await faqAPI.adminList();
      setFaqs(r.data.data || []);
    } catch {
      toast.error('Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data) {
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await faqAPI.adminCreate(data);
        toast.success('FAQ created');
      } else {
        await faqAPI.adminUpdate(modal.faq.id, data);
        toast.success('FAQ updated');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await faqAPI.adminDelete(deleteTarget.id);
      toast.success('FAQ deleted');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Delete failed');
    }
  }

  async function togglePublished(faq) {
    try {
      await faqAPI.adminUpdate(faq.id, { is_published: !faq.is_published });
      setFaqs((prev) => prev.map((f) => f.id === faq.id ? { ...f, is_published: !f.is_published } : f));
    } catch {
      toast.error('Update failed');
    }
  }

  const allCategories = ['All', ...Array.from(new Set(faqs.map((f) => f.category || 'General')))];

  const displayed = faqs.filter((f) => {
    if (filterCategory !== 'All' && f.category !== filterCategory) return false;
    if (filterPublished === 'published' && !f.is_published) return false;
    if (filterPublished === 'draft' && f.is_published) return false;
    return true;
  });

  return (
    <>
      <Head><title>FAQ Management — SolNuv Admin</title></Head>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
              <RiQuestionLine className="text-forest-400" />
              FAQ Management
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {faqs.length} total · {faqs.filter((f) => f.is_published).length} published
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              className="flex items-center gap-2 px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <RiAddLine /> New FAQ
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filterCategory === cat ? 'bg-forest-700 text-white border-forest-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-forest-500'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <select
            value={filterPublished}
            onChange={(e) => setFilterPublished(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-forest-500"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-slate-500">Loading…</div>
          ) : displayed.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <RiQuestionLine className="text-4xl mx-auto mb-2 opacity-40" />
              No FAQs found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-400">Question</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">Order</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400">Blog Link</th>
                  {canEdit && <th className="px-4 py-3 text-xs font-semibold text-slate-400">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayed.map((faq, idx) => (
                  <tr key={faq.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${idx === displayed.length - 1 ? 'border-0' : ''}`}>
                    <td className="px-5 py-3 max-w-xs">
                      <p className="text-slate-200 font-medium line-clamp-2">{faq.question}</p>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{faq.answer}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{faq.category}</td>
                    <td className="px-4 py-3 text-slate-400">{faq.order_index}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => canEdit && togglePublished(faq)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${STATUS_COLORS[String(faq.is_published)]} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        title={canEdit ? 'Click to toggle' : ''}
                      >
                        {faq.is_published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {faq.blog_post_slug ? (
                        <span className="inline-flex items-center gap-1 text-xs text-forest-400">
                          <RiArticleLine />
                          <span className="truncate max-w-[100px]">{faq.blog_post_slug}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit', faq })}
                            className="text-slate-400 hover:text-sky-400 transition-colors"
                            title="Edit"
                          >
                            <RiEditLine />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(faq)}
                            className="text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <RiDeleteBinLine />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'New FAQ' : 'Edit FAQ'}
          onClose={() => setModal(null)}
        >
          <FaqForm
            initial={modal.faq}
            onSave={handleSave}
            onCancel={() => setModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Modal title="Delete FAQ" onClose={() => setDeleteTarget(null)}>
          <p className="text-slate-300 text-sm mb-2">Are you sure you want to delete this FAQ?</p>
          <p className="text-slate-400 text-xs bg-slate-800 rounded-lg p-3 mb-6 line-clamp-3">
            {deleteTarget.question}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function AdminFaqPageWrapper() {
  return (
    <AdminRoute>
      <FaqAdminPage />
    </AdminRoute>
  );
}

AdminFaqPageWrapper.getLayout = getAdminLayout;
export default AdminFaqPageWrapper;
