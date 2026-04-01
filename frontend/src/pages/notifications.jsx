import Head from 'next/head';
import { useEffect, useState } from 'react';
import { authAPI } from '../services/api';
import { getDashboardLayout } from '../components/Layout';
import { MotionSection } from '../components/PageMotion';
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
    // Pass mark_read=true so the bell badge resets after visiting this page
    authAPI.getNotifications(true)
      .then((r) => setNotifications(r.data.data || []))
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head><title>Notifications — SolNuv</title></Head>

      <MotionSection className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-forest-900 to-emerald-900 text-white px-8 py-10 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3">
            <RiBellLine /> Platform Alerts
          </span>
          <h1 className="font-display font-bold text-3xl">Notifications</h1>
          <p className="text-white/70 text-sm mt-2">Latest platform alerts, payments, and recovery updates</p>
        </div>
      </MotionSection>

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
