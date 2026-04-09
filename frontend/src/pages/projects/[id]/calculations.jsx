import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { calculatorAPI, downloadBlob } from '../../../services/api';
import { getDashboardLayout } from '../../../components/Layout';
import { MotionSection } from '../../../components/PageMotion';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { RiArrowLeftLine, RiCalculatorLine, RiDownloadLine, RiDeleteBinLine, RiTimeLine, RiSunLine, RiBatteryLine, RiAlertLine, RiCheckLine } from 'react-icons/ri';

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
  const { id: projectId } = router.query;
  const { isPro } = useAuth();
  const [calculations, setCalculations] = useState({ active: [], expired: [] });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    loadCalculations();
  }, [projectId]);

  async function loadCalculations() {
    setLoading(true);
    try {
      const res = await calculatorAPI.getProjectCalculations(projectId);
      setCalculations(res.data.data || { active: [], expired: [] });
    } catch (err) {
      toast.error('Failed to load calculations');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this calculation?')) return;
    setDeleting(id);
    try {
      await calculatorAPI.deleteSavedCalculation(id);
      toast.success('Calculation deleted');
      loadCalculations();
    } catch (err) {
      toast.error('Failed to delete calculation');
    } finally {
      setDeleting(null);
    }
  }

  async function handleExportPdf(calc) {
    try {
      const { exportToPdf } = await import('../../../utils/pdfExport');
      const tempDiv = document.createElement('div');
      document.body.appendChild(tempDiv);

      const React = await import('react');
      const { createRoot } = await import('react-dom/client');
      const CalculationPdfTemplate = (await import('../../../components/CalculationPdfTemplate')).default;
      const root = createRoot(tempDiv);

      await new Promise((resolve) => {
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
        setTimeout(resolve, 100);
      });

      await exportToPdf(tempDiv, `SolNuv_${calc.calculator_type}_${calc.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
      toast.success('PDF exported');
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Failed to export PDF');
    } finally {
      document.body.removeChild(tempDiv);
    }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function getDaysUntilExpiry(expiresAt) {
    const days = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    return days;
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
      <Head><title>Calculations — SolNuv</title></Head>

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

        {active.length === 0 && expired.length === 0 ? (
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
                      <div key={calc.id} className="card p-4 hover:shadow-md transition-shadow">
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
                          <div className="flex items-center gap-2">
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
    </>
  );
}

ProjectCalculations.getLayout = getDashboardLayout;
