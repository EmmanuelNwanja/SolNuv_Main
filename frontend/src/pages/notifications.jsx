import Head from 'next/head';
import { useEffect, useState } from 'react';
import { authAPI } from '../services/api';
import { getDashboardLayout } from '../components/Layout';
import { LoadingSpinner, EmptyState } from '../components/ui/index';
import { RiBellLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

function formatDate(value) {
  try {
    return new Date(value).toLocaleString('en-NG', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return value;
  }
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    authAPI.getNotifications()
      .then((r) => setNotifications(r.data.data || []))
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head><title>Notifications — SolNuv</title></Head>

      <div className="page-header">
        <h1 className="font-display font-bold text-2xl text-forest-900 flex items-center gap-2">
          <RiBellLine className="text-amber-500" /> Notifications
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Latest platform alerts, payments, and recovery updates</p>
      </div>

      <div className="max-w-3xl">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={RiBellLine}
            title="No notifications yet"
            description="You will see payment updates, compliance reminders, and recovery activity here."
          />
        ) : (
          <div className="card">
            <div className="space-y-3">
              {notifications.map((item) => (
                <div key={item.id} className={`rounded-xl border p-4 ${item.is_read ? 'bg-slate-50 border-slate-100' : 'bg-amber-50/40 border-amber-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.message}</p>
                      <p className="text-xs text-slate-400 mt-2 capitalize">{String(item.type || '').replace('_', ' ')}</p>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(item.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

NotificationsPage.getLayout = getDashboardLayout;
