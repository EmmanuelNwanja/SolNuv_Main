import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { reportsAPI, downloadBlob } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { PlanGate, LoadingSpinner } from '../../components/ui/index';
import { MotionSection } from '../../components/PageMotion';
import { RiFileTextLine, RiDownloadLine, RiSendPlane2Line, RiCheckLine, RiHistoryLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

export default function Reports() {
  const { profile, plan, isPro, company } = useAuth();
  const [generating, setGenerating] = useState(null); // 'download' | 'send'
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [periodStart, setPeriodStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    reportsAPI.getHistory()
      .then(r => setHistory(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  async function handleDownload() {
    setGenerating('download');
    try {
      const { data } = await reportsAPI.generateNesrea({ period_start: periodStart, period_end: periodEnd, action: 'download' });
      downloadBlob(data, `SolNuv_NESREA_Report_${periodEnd}.pdf`);
      toast.success('Report downloaded!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate report';
      toast.error(msg);
    } finally { setGenerating(null); }
  }

  async function handleSendToNesrea() {
    if (!window.confirm('This will send your EPR report directly to NESREA (compliance@nesrea.gov.ng). Continue?')) return;
    setGenerating('send');
    try {
      await reportsAPI.sendNesrea({ period_start: periodStart, period_end: periodEnd });
      toast.success('Report sent to NESREA! ✅');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send report');
    } finally { setGenerating(null); }
  }

  async function handleExcelExport() {
    setGenerating('excel');
    try {
      const { data } = await reportsAPI.exportExcel();
      downloadBlob(data, `SolNuv_Projects_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel exported!');
    } catch { toast.error('Export failed'); }
    finally { setGenerating(null); }
  }

  return (
    <>
      <Head><title>Reports — SolNuv</title></Head>

      <MotionSection className="mb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-forest-900 p-6 sm:p-8 text-white">
          <div className="absolute -top-20 -right-12 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.22em] text-white/60 mb-3">Compliance Studio</p>
            <h1 className="font-display font-bold text-3xl sm:text-4xl">Reports and Compliance</h1>
            <p className="text-white/75 text-sm mt-2 max-w-2xl">
              Generate NESREA EPR documents, download structured exports, and maintain a verifiable audit trail for your projects.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">Plan: {String(plan || 'free').toUpperCase()}</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{history.length} historical reports</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">EPR-ready workflow</span>
            </div>
          </div>
        </div>
      </MotionSection>

      <div className="max-w-3xl space-y-6">
        {/* NESREA Report Generator */}
        <PlanGate requiredPlan="pro" currentPlan={plan}>
          <MotionSection className="card">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-forest-900 rounded-xl flex items-center justify-center">
                <RiFileTextLine className="text-amber-400 text-lg" />
              </div>
              <div>
                <h2 className="font-semibold text-forest-900">NESREA EPR Compliance Report</h2>
                <p className="text-xs text-slate-500">National Environmental (Battery Control) Regulations 2024</p>
              </div>
            </div>

            {company?.nesrea_registration_number ? (
              <div className="bg-emerald-50 rounded-xl p-3 mb-4 flex items-center gap-2">
                <RiCheckLine className="text-emerald-600" />
                <p className="text-sm text-emerald-700">NESREA Reg. No: <strong>{company.nesrea_registration_number}</strong></p>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-xl p-3 mb-4">
                <p className="text-sm text-amber-700">⚠️ Add your NESREA Registration Number in Settings for it to appear on reports.</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="label">Report Period Start</label>
                <input type="date" className="input" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <label className="label">Report Period End</label>
                <input type="date" className="input" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-5">
              <p className="text-sm font-medium text-slate-700 mb-2">This report includes:</p>
              {['Cradle-to-Grave traceability for all listed projects', 'West African climate-adjusted decommission dates', 'Silver recovery calculations per project', 'Compliance declaration under 2024 Battery Regulations', 'Company NESREA registration details'].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-600 mb-1.5">
                  <RiCheckLine className="text-emerald-500 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleDownload} disabled={!!generating} className="btn-primary flex items-center justify-center gap-2 flex-1">
                {generating === 'download' ? <><LoadingSpinner size="sm" className="mr-1" /> Generating...</> : <><RiDownloadLine /> Download PDF</>}
              </button>
              <button onClick={handleSendToNesrea} disabled={!!generating || plan !== 'elite' && plan !== 'enterprise'} className="btn-outline flex items-center justify-center gap-2 flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
                {generating === 'send' ? <><LoadingSpinner size="sm" className="mr-1" /> Sending...</> : <><RiSendPlane2Line /> Auto-send to NESREA</>}
                {plan === 'pro' && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold ml-1">ELITE</span>}
              </button>
            </div>
          </MotionSection>
        </PlanGate>

        {/* Excel Export */}
        <PlanGate requiredPlan="pro" currentPlan={plan}>
          <MotionSection className="card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-forest-900">Excel Data Export</h2>
                <p className="text-xs text-slate-500 mt-0.5">Export all your projects as an Excel spreadsheet (.xlsx)</p>
              </div>
              <button onClick={handleExcelExport} disabled={!!generating} className="btn-outline flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl">
                {generating === 'excel' ? <LoadingSpinner size="sm" /> : <RiDownloadLine />}
                Export Excel
              </button>
            </div>
          </MotionSection>
        </PlanGate>

        {/* Report History */}
        <MotionSection className="card">
          <h2 className="font-semibold text-forest-900 flex items-center gap-2 mb-4">
            <RiHistoryLine /> Report History
          </h2>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No reports generated yet</p>
          ) : (
            <div className="space-y-2">
              {history.map(report => (
                <div key={report.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {new Date(report.report_period_start).toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })} –{' '}
                      {new Date(report.report_period_end).toLocaleDateString('en-NG', { year: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {report.total_panels} panels · {report.total_batteries} batteries
                      {report.sent_to_nesrea && ' · ✅ Sent to NESREA'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">{new Date(report.created_at).toLocaleDateString('en-NG')}</p>
                </div>
              ))}
            </div>
          )}
        </MotionSection>
      </div>
    </>
  );
}

Reports.getLayout = getDashboardLayout;
