import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { queryParamToString } from '../../../utils/nextRouter';
import Link from 'next/link';
import { calculatorAPI } from '../../../services/api';
import { getDashboardLayout } from '../../../components/Layout';
import { MotionSection } from '../../../components/PageMotion';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { RiArrowLeftLine, RiCalculatorLine, RiDownloadLine, RiDeleteBinLine, RiTimeLine, RiEyeLine, RiCloseLine, RiCheckLine, RiAlertLine } from 'react-icons/ri';
import CalculationPdfTemplate from '../../../components/CalculationPdfTemplate';

const CALC_LABELS = {
  panel: 'Panel Value',
  battery: 'Battery Value',
  degrad: 'Decommission Date',
  roi: 'Hybrid ROI',
  soh: 'Battery SoH',
  cable: 'DC Cable Sizing',
  motor: 'Motor Starting',
  gfm: 'GFM Selector',
  tdd: 'TDD Report',
};

const CALC_ICONS = {
  panel: '☀️',
  battery: '🔋',
  degrad: '📅',
  roi: '💼',
  soh: '🧪',
  cable: '🧰',
  motor: '⚡',
  gfm: '🔋',
  tdd: '📋',
};

export default function ProjectCalculations() {
  const router = useRouter();
  const projectId = queryParamToString(router.query.id);
  const { isPro } = useAuth();
  const [calculations, setCalculations] = useState({ active: [], expired: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [selectedCalc, setSelectedCalc] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    loadCalculations();
  }, [projectId]);

  async function loadCalculations() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await calculatorAPI.getProjectCalculations(projectId);
      if (res.data?.success && res.data?.data) {
        setCalculations(res.data.data);
      } else {
        setCalculations({ active: [], expired: [] });
      }
    } catch (err) {
      console.error('Failed to load calculations:', err);
      setLoadError(err?.response?.data?.message || 'Failed to load calculations');
      toast.error('Failed to load calculations');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this calculation? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await calculatorAPI.deleteSavedCalculation(id);
      toast.success('Calculation deleted');
      setSelectedCalc(null);
      loadCalculations();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete calculation');
    } finally {
      setDeleting(null);
    }
  }

  async function handleExportPdf(calc) {
    if (!calc) return;
    setExporting(true);
    try {
      const { exportToPdf } = await import('../../../utils/pdfExport');
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      const React = await import('react');
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempDiv);

      root.render(
        React.createElement(CalculationPdfTemplate, {
          type: calc.calculator_type,
          name: calc.name,
          inputs: calc.input_params,
          results: calc.result_data,
          project: calc.project_id,
          createdAt: calc.created_at,
          expiresAt: calc.expires_at,
        })
      );

      await new Promise(resolve => setTimeout(resolve, 500));
      await exportToPdf(tempDiv, `SolNuv_${calc.calculator_type}_${calc.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
      toast.success('PDF exported successfully');
      document.body.removeChild(tempDiv);
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function getDaysUntilExpiry(expiresAt: string) {
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  function renderCalcDetails(calc) {
    if (!calc) return null;
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl">
              {CALC_ICONS[calc.calculator_type] || '📊'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{calc.name}</h3>
              <p className="text-sm text-gray-500">
                {CALC_LABELS[calc.calculator_type] || calc.calculator_type} • Saved {formatDate(calc.created_at)}
              </p>
            </div>
          </div>
          <button onClick={() => setSelectedCalc(null)} className="p-2 hover:bg-gray-100 rounded-lg">
            <RiCloseLine className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {calc.notes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">{calc.notes}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <RiCalculatorLine className="w-4 h-4" /> Input Parameters
            </h4>
            <div className="space-y-2 text-sm">
              {Object.entries(calc.input_params || {}).map(([key, value]) => {
                if (value === undefined || value === null || value === '') return null;
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const formattedValue = typeof value === 'number' 
                  ? value.toLocaleString('en-NG', { maximumFractionDigits: 4 })
                  : String(value);
                return (
                  <div key={key} className="flex justify-between border-b border-gray-200 pb-1">
                    <span className="text-gray-500">{formattedKey}</span>
                    <span className="font-medium text-gray-900">{formattedValue}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
              <RiCheckLine className="w-4 h-4" /> Results
            </h4>
            <div className="space-y-2 text-sm">
              {Object.entries(calc.result_data || {}).map(([key, value]) => {
                if (value === undefined || value === null) return null;
                if (typeof value === 'object') return null;
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const formattedValue = typeof value === 'number' 
                  ? value.toLocaleString('en-NG', { maximumFractionDigits: 4 })
                  : String(value);
                return (
                  <div key={key} className="flex justify-between border-b border-emerald-100 pb-1">
                    <span className="text-emerald-600">{formattedKey}</span>
                    <span className="font-bold text-emerald-800">{formattedValue}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={() => handleExportPdf(calc)}
            disabled={exporting}
            className="btn-outline flex-1 flex items-center justify-center gap-2"
          >
            <RiDownloadLine /> {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
          <button
            onClick={() => handleDelete(calc.id)}
            disabled={deleting === calc.id}
            className="btn-outline flex items-center gap-2 px-4 text-red-600 hover:bg-red-50"
          >
            <RiDeleteBinLine /> {deleting === calc.id ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const { active, expired } = calculations;

  return (
    <>
      <Head><title>Project Calculations — SolNuv</title></Head>

      <MotionSection>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/projects/${projectId}`)} className="btn-icon">
            <RiArrowLeftLine />
          </button>
          <div>
            <h1 className="text-xl font-bold text-forest-900">Project Calculations</h1>
            <p className="text-sm text-gray-500">Engineering calculations saved to this project</p>
          </div>
        </div>

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">{loadError}</p>
            <button onClick={loadCalculations} className="text-sm text-red-600 underline mt-2">
              Try Again
            </button>
          </div>
        )}

        {active.length === 0 && expired.length === 0 && !loadError ? (
          <div className="card text-center py-12">
            <RiCalculatorLine className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Calculations Yet</h3>
            <p className="text-sm text-gray-500 mb-4">Run calculations in the Engineering Suite and save them to this project.</p>
            <Link href="/calculator" className="btn-primary inline-flex items-center gap-2">
              <RiCalculatorLine /> Go to Calculator
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <RiCheckLine className="text-emerald-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Active Calculations</h2>
                  <span className="text-sm text-gray-500">({active.length})</span>
                </div>
                <div className="space-y-3">
                  {active.map(calc => {
                    const daysLeft = getDaysUntilExpiry(calc.expires_at);
                    const isExpiringSoon = daysLeft <= 7;
                    return (
                      <div 
                        key={calc.id} 
                        className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => setSelectedCalc(calc)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-lg">
                              {CALC_ICONS[calc.calculator_type] || '📊'}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{calc.name}</h3>
                              <p className="text-sm text-gray-500">
                                {CALC_LABELS[calc.calculator_type] || calc.calculator_type} • Saved {formatDate(calc.created_at)}
                              </p>
                              {calc.notes && (
                                <p className="text-xs text-gray-400 mt-1">{calc.notes}</p>
                              )}
                              <div className="flex items-center gap-1 mt-2">
                                <RiTimeLine className={`w-3 h-3 ${isExpiringSoon ? 'text-amber-500' : 'text-gray-400'}`} />
                                <span className={`text-xs ${isExpiringSoon ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                                  Expires in {daysLeft} days
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleExportPdf(calc)}
                              className="btn-outline text-sm px-3 py-1.5 flex items-center gap-1"
                            >
                              <RiDownloadLine /> PDF
                            </button>
                            <button
                              onClick={() => handleDelete(calc.id)}
                              disabled={deleting === calc.id}
                              className="btn-outline text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 flex items-center gap-1"
                            >
                              <RiDeleteBinLine />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {expired.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <RiAlertLine className="text-amber-500" />
                  <h2 className="text-lg font-semibold text-gray-700">Expired Calculations</h2>
                  <span className="text-sm text-gray-500">({expired.length})</span>
                </div>
                <div className="space-y-3">
                  {expired.map(calc => (
                    <div key={calc.id} className="card p-4 opacity-60 bg-gray-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-lg">
                            {CALC_ICONS[calc.calculator_type] || '📊'}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-500">{calc.name}</h3>
                            <p className="text-sm text-gray-400">
                              {CALC_LABELS[calc.calculator_type] || calc.calculator_type} • Expired {formatDate(calc.expires_at)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(calc.id)}
                          disabled={deleting === calc.id}
                          className="btn-outline text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 flex items-center gap-1"
                        >
                          <RiDeleteBinLine /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </MotionSection>

      {/* Calculation Detail Modal */}
      {selectedCalc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedCalc(null)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-xl">
                    {CALC_ICONS[selectedCalc.calculator_type] || '📊'}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedCalc.name}</h2>
                    <p className="text-sm text-gray-500">
                      {CALC_LABELS[selectedCalc.calculator_type] || selectedCalc.calculator_type}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedCalc(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <RiCloseLine className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {renderCalcDetails(selectedCalc)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

ProjectCalculations.getLayout = getDashboardLayout;
