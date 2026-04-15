import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { projectsAPI } from '../../../services/api';
import { LoadingSpinner } from '../../../components/ui/index';
import toast from 'react-hot-toast';

export default function BatteryLedgerFieldPage() {
  const router = useRouter();
  const qrRaw = router.query.qr;
  const qr = typeof qrRaw === 'string' ? qrRaw : Array.isArray(qrRaw) ? qrRaw[0] : '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ledger, setLedger] = useState(null);
  const [logForm, setLogForm] = useState({
    log_date: new Date().toISOString().split('T')[0],
    measured_voltage: '',
    measured_capacity_kwh: '',
    avg_depth_of_discharge_pct: '',
    estimated_cycles_per_day: '',
    ambient_temperature_c: '30',
    estimated_soh_pct: '',
    cumulative_damage_pct: '',
    notes: '',
    technician_name: '',
  });

  async function loadLedger() {
    if (!qr) return;
    setLoading(true);
    try {
      const { data } = await projectsAPI.getBatteryLedgerByQr(qr);
      setLedger(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load battery ledger');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLedger();
  }, [qr]);

  async function submitLog(e) {
    e.preventDefault();
    if (!qr) return;

    setSubmitting(true);
    try {
      await projectsAPI.addBatteryLogByQr(qr, {
        ...logForm,
        measured_voltage: logForm.measured_voltage ? Number(logForm.measured_voltage) : null,
        measured_capacity_kwh: logForm.measured_capacity_kwh ? Number(logForm.measured_capacity_kwh) : null,
        avg_depth_of_discharge_pct: logForm.avg_depth_of_discharge_pct ? Number(logForm.avg_depth_of_discharge_pct) : null,
        estimated_cycles_per_day: logForm.estimated_cycles_per_day ? Number(logForm.estimated_cycles_per_day) : null,
        ambient_temperature_c: logForm.ambient_temperature_c ? Number(logForm.ambient_temperature_c) : null,
        estimated_soh_pct: logForm.estimated_soh_pct ? Number(logForm.estimated_soh_pct) : null,
        cumulative_damage_pct: logForm.cumulative_damage_pct ? Number(logForm.cumulative_damage_pct) : null,
      });
      toast.success('Battery health log submitted');
      setLogForm((f) => ({ ...f, notes: '', measured_voltage: '', measured_capacity_kwh: '' }));
      await loadLedger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit log');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading battery ledger...</p>
        </div>
      </div>
    );
  }

  const asset = ledger?.asset;
  const latest = ledger?.latest_log;
  const logs = ledger?.logs || [];

  return (
    <>
      <Head><title>Battery Ledger - SolNuv Field</title></Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="relative overflow-hidden bg-gradient-to-br from-forest-900 via-emerald-900 to-slate-900 text-white rounded-2xl p-5">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
            <div className="relative">
              <p className="text-xs text-white/60 uppercase tracking-widest font-semibold mb-1">QR-linked Battery Ledger</p>
              <h1 className="font-display font-bold text-2xl mt-1">{asset?.brand} · {asset?.chemistry}</h1>
              <p className="text-sm text-white/80 mt-1">Project: {asset?.projects?.name} ({asset?.projects?.city}, {asset?.projects?.state})</p>
              <p className="text-xs text-white/60 mt-1">Capacity: {asset?.capacity_kwh}kWh × {asset?.quantity}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card">
              <p className="text-xs text-slate-500">Latest Logged SoH</p>
              <p className="font-display font-bold text-4xl text-forest-900 mt-1">{latest?.estimated_soh_pct ?? '-'}%</p>
              <p className="text-xs text-slate-400 mt-2">Last update: {latest?.log_date ? new Date(latest.log_date).toLocaleDateString('en-NG') : 'No logs yet'}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">Warranty Window</p>
              <p className="font-display font-bold text-3xl text-forest-900 mt-1">{asset?.warranty_years || 5} years</p>
              <p className="text-xs text-slate-400 mt-2">Installed: {asset?.installation_date ? new Date(asset.installation_date).toLocaleDateString('en-NG') : '-'}</p>
            </div>
          </div>

          <form onSubmit={submitLog} className="card space-y-3">
            <h2 className="font-semibold text-forest-900">Submit Field Health Log</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Log Date</label>
                <input type="date" className="input" value={logForm.log_date} onChange={(e) => setLogForm((f) => ({ ...f, log_date: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Technician Name</label>
                <input className="input" value={logForm.technician_name} onChange={(e) => setLogForm((f) => ({ ...f, technician_name: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Measured Voltage</label>
                <input type="number" step="0.01" className="input" value={logForm.measured_voltage} onChange={(e) => setLogForm((f) => ({ ...f, measured_voltage: e.target.value }))} />
              </div>
              <div>
                <label className="label">Measured Capacity (kWh)</label>
                <input type="number" step="0.01" className="input" value={logForm.measured_capacity_kwh} onChange={(e) => setLogForm((f) => ({ ...f, measured_capacity_kwh: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Avg DoD (%)</label>
                <input type="number" className="input" value={logForm.avg_depth_of_discharge_pct} onChange={(e) => setLogForm((f) => ({ ...f, avg_depth_of_discharge_pct: e.target.value }))} />
              </div>
              <div>
                <label className="label">Cycles/Day</label>
                <input type="number" step="0.1" className="input" value={logForm.estimated_cycles_per_day} onChange={(e) => setLogForm((f) => ({ ...f, estimated_cycles_per_day: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Estimated SoH (%)</label>
                <input type="number" step="0.01" className="input" value={logForm.estimated_soh_pct} onChange={(e) => setLogForm((f) => ({ ...f, estimated_soh_pct: e.target.value }))} />
              </div>
              <div>
                <label className="label">Cumulative Damage (%)</label>
                <input type="number" step="0.01" className="input" value={logForm.cumulative_damage_pct} onChange={(e) => setLogForm((f) => ({ ...f, cumulative_damage_pct: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input min-h-[90px]" value={logForm.notes} onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Site conditions, load behavior, observed faults..." />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Submitting...' : 'Submit Battery Log'}</button>
          </form>

          <div className="card">
            <h2 className="font-semibold text-forest-900 mb-3">Recent Logs</h2>
            <div className="space-y-2">
              {logs.length === 0 && <p className="text-sm text-slate-400">No logs yet</p>}
              {logs.map((log) => (
                <div key={log.id} className="border border-slate-100 rounded-xl p-3">
                  <p className="text-sm font-medium text-slate-700">{new Date(log.log_date).toLocaleDateString('en-NG')} · SoH {log.estimated_soh_pct ?? '-'}%</p>
                  <p className="text-xs text-slate-500">Voltage: {log.measured_voltage ?? '-'}V · Capacity: {log.measured_capacity_kwh ?? '-'}kWh · DoD: {log.avg_depth_of_discharge_pct ?? '-'}%</p>
                  {log.notes && <p className="text-xs text-slate-500 mt-1">{log.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
