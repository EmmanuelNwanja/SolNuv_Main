import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import {
  RiMailLine, RiCheckLine, RiCloseLine, RiDeleteBinLine,
  RiArrowRightLine, RiPhoneLine, RiCalendarLine, RiRefreshLine,
} from 'react-icons/ri';
import { useAuth } from '../../context/AuthContext';
import AdminRoute from '../../components/AdminRoute';
import { getAdminLayout } from '../../components/Layout';
import { contactAPI } from '../../services/api';
import toast from 'react-hot-toast';

const STATUS_LABELS = { new: 'New', in_progress: 'In Progress', resolved: 'Resolved', spam: 'Spam' };
const STATUS_COLORS = {
  new: 'bg-amber-900/30 text-amber-400 border-amber-800',
  in_progress: 'bg-blue-900/30 text-blue-400 border-blue-800',
  resolved: 'bg-emerald-900/30 text-emerald-400 border-emerald-800',
  spam: 'bg-red-900/30 text-red-400 border-red-800',
};

function SubmissionDetail({ sub, onUpdate, onClose }) {
  const [status, setStatus] = useState(sub.status);
  const [notes, setNotes] = useState(sub.admin_notes || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onUpdate(sub.id, { status, admin_notes: notes });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-display font-bold text-white">Submission Detail</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><RiCloseLine className="text-xl" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Name</p>
              <p className="text-slate-200">{sub.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Email</p>
              <a href={`mailto:${sub.email}`} className="text-emerald-400 hover:underline">{sub.email}</a>
            </div>
            {sub.phone && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Phone</p>
                <a href={`tel:${sub.phone}`} className="text-slate-200">{sub.phone}</a>
              </div>
            )}
            {sub.subject && (
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Subject</p>
                <p className="text-slate-200">{sub.subject}</p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Submitted</p>
              <p className="text-slate-400">{new Date(sub.submitted_at).toLocaleString('en-NG')}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Message</p>
            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-200 whitespace-pre-wrap">{sub.message}</div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 uppercase font-semibold mb-1">Status</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 uppercase font-semibold mb-1">Admin Notes</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              <RiCheckLine /> {saving ? 'Saving…' : 'Update'}
            </button>
          </div>

          {/* Quick reply link */}
          <a
            href={`mailto:${sub.email}?subject=Re: ${encodeURIComponent(sub.subject || 'Your enquiry to SolNuv')}`}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-emerald-800 text-emerald-400 hover:bg-emerald-900/20 text-sm transition-colors"
          >
            <RiMailLine /> Reply via Email
          </a>
        </div>
      </div>
    </div>
  );
}

function ContactAdminPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (p = 1, status = statusFilter) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (status) params.status = status;
      const { data } = await contactAPI.adminList(params);
      setSubmissions(data.data || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch { toast.error('Failed to load submissions'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(page, statusFilter); }, [page, statusFilter]);

  async function handleUpdate(id, updates) {
    try {
      await contactAPI.adminUpdate(id, updates);
      toast.success('Submission updated');
      load(page, statusFilter);
    } catch { toast.error('Failed to update submission'); }
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this submission?')) return;
    try {
      await contactAPI.adminDelete(id);
      toast.success('Deleted');
      load(page, statusFilter);
    } catch { toast.error('Failed to delete submission'); }
  }

  const counts = { all: submissions.length };

  return (
    <>
      <Head><title>Contact Submissions - SolNuv Admin</title></Head>

      <div className="p-6 max-w-screen-xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Contact Submissions</h1>
            <p className="text-sm text-slate-400">Manage and respond to contact form enquiries</p>
          </div>
          <button onClick={() => load(page, statusFilter)} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors" title="Refresh">
            <RiRefreshLine />
          </button>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[{ label: 'All', value: '' }, ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ label: l, value: v }))].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => { setStatusFilter(value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse" />)}</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <RiMailLine className="text-4xl mx-auto mb-2" />
            <p>No submissions found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((sub) => (
              <div key={sub.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3 hover:border-slate-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-100">{sub.name}</p>
                  <p className="text-xs text-slate-400">{sub.email} {sub.phone && <span className="ml-2">· {sub.phone}</span>}</p>
                  {sub.subject && <p className="text-xs text-slate-500 italic mt-0.5">{sub.subject}</p>}
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{sub.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 whitespace-nowrap flex items-center gap-1">
                    <RiCalendarLine />{new Date(sub.submitted_at).toLocaleDateString('en-NG')}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_COLORS[sub.status]}`}>
                    {STATUS_LABELS[sub.status]}
                  </span>
                  <button onClick={() => setSelected(sub)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors">
                    View <RiArrowRightLine />
                  </button>
                  <button onClick={() => handleDelete(sub.id)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors">
                    <RiDeleteBinLine />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 disabled:opacity-40 hover:bg-slate-800">Previous</button>
            <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 disabled:opacity-40 hover:bg-slate-800">Next</button>
          </div>
        )}
      </div>

      {selected && (
        <SubmissionDetail sub={selected} onUpdate={handleUpdate} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

ContactAdminPage.getLayout = getAdminLayout;

export default function ContactAdminPageWrapper() {
  return (
    <AdminRoute>
      <ContactAdminPage />
    </AdminRoute>
  );
}
