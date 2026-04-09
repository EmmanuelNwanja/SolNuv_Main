import React from 'react';
import { RiSunLine, RiCalculatorLine, RiCalendarLine, RiTimeLine } from 'react-icons/ri';

const CALCULATOR_LABELS = {
  panel: 'Panel Value Calculator',
  battery: 'Battery Value Calculator',
  degrad: 'Decommission Date Calculator',
  roi: 'Hybrid ROI Calculator',
  soh: 'Battery SoH Calculator',
  cable: 'DC Cable Sizing Calculator',
  motor: 'Motor Starting Calculator',
  gfm: 'GFM Selector Calculator',
  tdd: 'TDD Report Calculator',
};

function CalculationTemplate({ type, name, inputs, results, project, createdAt, expiresAt }) {
  const label = CALCULATOR_LABELS[type] || 'Calculation';
  const calcName = name || `${label} Result`;
  
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const daysUntilExpiry = expiresAt 
    ? Math.max(0, Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="bg-white text-gray-900 font-sans p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="border-b-2 border-emerald-600 pb-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
              <RiSunLine className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">SolNuv</h1>
              <p className="text-sm text-gray-500">Solar Engineering Platform</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Calculation Report</p>
          </div>
        </div>
      </div>

      {/* Title Section */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 -mx-8 px-8 py-6 mb-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <RiCalculatorLine className="w-5 h-5 text-emerald-300" />
          <span className="text-xs uppercase tracking-widest text-emerald-300">{label}</span>
        </div>
        <h2 className="text-2xl font-bold">{calcName}</h2>
      </div>

      {/* Project Info */}
      {project && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Associated Project</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Project:</span>
              <span className="ml-2 font-medium">{project.name || 'N/A'}</span>
            </div>
            {project.city && (
              <div>
                <span className="text-gray-500">Location:</span>
                <span className="ml-2 font-medium">{project.city}, {project.state}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Parameters */}
      {inputs && Object.keys(inputs).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Input Parameters</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(inputs).map(([key, value]) => {
              if (value === undefined || value === null || value === '') return null;
              const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const formattedValue = typeof value === 'number' 
                ? value.toLocaleString('en-NG', { maximumFractionDigits: 4 })
                : String(value);
              return (
                <div key={key} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">{formattedKey}</p>
                  <p className="text-sm font-medium text-gray-900">{formattedValue}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      {results && Object.keys(results).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Results</h3>
          <div className="space-y-3">
            {Object.entries(results).map(([key, value]) => {
              if (value === undefined || value === null) return null;
              const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const displayValue = typeof value === 'object' 
                ? JSON.stringify(value, null, 2)
                : typeof value === 'number'
                ? value.toLocaleString('en-NG', { maximumFractionDigits: 4 })
                : String(value);
              return (
                <div key={key} className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                  <p className="text-xs text-emerald-600 mb-1">{formattedKey}</p>
                  <p className="text-lg font-bold text-emerald-800 whitespace-pre-wrap">{displayValue}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-gray-100 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <RiCalendarLine className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Generated</p>
              <p className="font-medium">{formatDate(createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RiTimeLine className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Expires</p>
              <p className="font-medium">{daysUntilExpiry !== null ? `${daysUntilExpiry} days` : formatDate(expiresAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <p>Generated by SolNuv Engineering Suite</p>
          <p>{new Date().toLocaleDateString('en-NG')}</p>
        </div>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Disclaimer:</strong> This calculation is for preliminary assessment purposes only. 
            Actual results may vary based on site conditions, equipment specifications, and installation quality. 
            A detailed engineering study by a qualified professional is recommended.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CalculationTemplate;
