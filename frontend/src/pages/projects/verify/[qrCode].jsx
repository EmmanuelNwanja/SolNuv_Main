import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { projectsAPI } from '../../../services/api';
import { LoadingSpinner } from '../../../components/ui';
import {
  RiBuildingLine,
  RiCalendarLine,
  RiCheckboxCircleLine,
  RiHistoryLine,
  RiMailLine,
  RiMapPinLine,
  RiPhoneLine,
  RiPlantLine,
  RiShieldCheckLine,
  RiStackLine,
  RiToolsLine,
  RiUserStarLine,
} from 'react-icons/ri';

function formatDate(value) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatNumber(value, digits = 2) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(digits) : '0.00';
}

function EquipmentTable({ title, rows, unitLabel, icon }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>

      {(rows || []).length === 0 && (
        <p className="px-5 py-5 text-sm text-slate-500">No {title.toLowerCase()} listed.</p>
      )}

      {(rows || []).length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Manufacturer</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Model</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Quantity</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Capacity</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Condition</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, idx) => {
                const panelCapacity = item.size_watts ? `${item.size_watts}W` : null;
                const batteryCapacity = item.capacity_kwh ? `${item.capacity_kwh}kWh` : null;
                const inverterCapacity = item.power_kw ? `${item.power_kw}kW` : null;
                const capacityText = panelCapacity || batteryCapacity || inverterCapacity || unitLabel || '-';

                return (
                  <tr key={`${item.brand || 'eq'}-${idx}`} className="border-t border-slate-100">
                    <td className="px-5 py-3 text-slate-800 font-medium">{item.brand || 'N/A'}</td>
                    <td className="px-5 py-3 text-slate-600">{item.model || 'N/A'}</td>
                    <td className="px-5 py-3 text-slate-600">{item.quantity || 0}</td>
                    <td className="px-5 py-3 text-slate-600">{capacityText}</td>
                    <td className="px-5 py-3 text-slate-600 capitalize">{item.condition || 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const CHANGE_TYPE_LABELS = {
  project_created: { label: 'Created', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  project_updated: { label: 'Updated', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  equipment_added: { label: 'Equipment Added', color: 'text-forest-900 bg-slate-50 border-slate-200' },
  equipment_updated: { label: 'Equipment Updated', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  equipment_removed: { label: 'Equipment Removed', color: 'text-red-700 bg-red-50 border-red-200' },
};

function HistoryAppendix({ history }) {
  if (!history || history.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <RiHistoryLine className="text-forest-900" />
        <h3 className="font-semibold text-slate-900">Project History — Appendix</h3>
        <span className="ml-auto text-xs text-slate-400">{history.length} event{history.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {history.map((entry, i) => {
          const meta = CHANGE_TYPE_LABELS[entry.change_type] || { label: entry.change_type, color: 'text-slate-600 bg-slate-50 border-slate-200' };
          const changedFields = entry.changed_fields ? Object.entries(entry.changed_fields) : [];
          return (
            <div key={entry.id || i} className="px-5 py-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
                    {entry.project_stage && (
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Stage: {entry.project_stage}</span>
                    )}
                  </div>
                  {entry.change_summary && (
                    <p className="mt-1.5 text-sm text-slate-700">{entry.change_summary}</p>
                  )}
                  {changedFields.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {changedFields.map(([field, diff]) => (
                        <p key={field} className="text-xs text-slate-500">
                          <span className="font-medium capitalize">{field.replace(/_/g, ' ')}</span>:&nbsp;
                          <span className="text-red-500 line-through">{String(diff.from ?? '—')}</span>
                          &nbsp;→&nbsp;
                          <span className="text-emerald-600 font-medium">{String(diff.to ?? '—')}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">{formatDate(entry.created_at)}</p>
                  {entry.actor_name && <p className="text-xs text-slate-400 mt-0.5">by {entry.actor_name}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ProjectVerifyPage() {
  const router = useRouter();
  const { qrCode } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState(null);

  useEffect(() => {
    if (!qrCode) return;

    const fetchVerification = async () => {
      setLoading(true);
      setError('');

      try {
        const { data } = await projectsAPI.verify(qrCode);
        setVerification(data.data);
      } catch (err) {
        setVerification(null);
        setError(err.response?.data?.message || 'Project verification failed');
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [qrCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-slate-600 text-sm">Verifying project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Project Verification - SolNuv</title>
        </Head>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
            <h1 className="text-xl font-semibold text-slate-900">Verification Unavailable</h1>
            <p className="text-slate-600 mt-2">{error}</p>
            <Link href="/" className="inline-block mt-4 text-forest-900 font-semibold hover:underline">
              Return Home
            </Link>
          </div>
        </div>
      </>
    );
  }

  const brand = verification?.brand || {};
  const project = verification?.project || {};
  const summary = verification?.summary || {};
  const equipment = verification?.equipment_breakdown || {};
  const manufacturers = verification?.manufacturers || {};
  const verificationStatus = verification?.verification_status || 'Unverified';

  function printCertificate() {
    if (typeof window !== 'undefined') window.print();
  }

  return (
    <>
      <Head>
        <title>{project?.name || 'Project'} Verification - SolNuv</title>
        <meta name="description" content={`Verify ${project?.name || 'solar project'} by ${brand?.name || 'installer'} on SolNuv.`} />
        <meta property="og:title" content={`${project?.name || 'Project'} Verification`} />
        <meta property="og:description" content={`Status: ${verificationStatus}. Capacity: ${formatNumber(summary?.total_project_capacity_mw, 4)} MW.`} />
        <meta property="og:type" content="article" />
        {brand?.logo_url && <meta property="og:image" content={brand.logo_url} />}
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 p-4 md:p-8 lg:p-10">
        <div className="max-w-6xl mx-auto space-y-6">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-900 via-emerald-900 to-slate-900 text-white p-6 md:p-8 shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_55%)]" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {brand?.logo_url ? (
                    <img src={brand.logo_url} alt={brand.name || 'Brand logo'} className="w-14 h-14 rounded-xl object-cover border border-white/25 bg-white" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border border-white/25 bg-white/10 flex items-center justify-center">
                      <RiBuildingLine className="text-2xl text-white/90" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs tracking-[0.2em] uppercase text-emerald-300">Project Verification</p>
                    <h1 className="font-display font-bold text-3xl mt-1">{project?.name || 'Verified Project'}</h1>
                    <p className="text-white/75 text-sm mt-1">By {brand?.name || 'SolNuv Verified Installer'}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-right">
                  <p className="text-xs text-white/70 uppercase">Verification</p>
                  <p className="font-semibold flex items-center gap-1"><RiShieldCheckLine /> {verificationStatus}</p>
                </div>

                <div className="flex items-center gap-2 no-print">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${verificationStatus === 'Verified' ? 'bg-emerald-400/20 border-emerald-200 text-emerald-100' : verificationStatus === 'Authenticated' ? 'bg-blue-400/20 border-blue-200 text-blue-100' : 'bg-amber-400/20 border-amber-200 text-amber-100'}`}>
                    {verificationStatus}
                  </span>
                  <button onClick={printCertificate} className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/20 transition">
                    Print Certificate
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                <div className="rounded-xl bg-white/10 border border-white/10 p-3">
                  <p className="text-xs text-white/70">Project Capacity</p>
                  <p className="font-display text-2xl font-bold">{formatNumber(summary?.total_project_capacity_mw, 4)} MW</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-3">
                  <p className="text-xs text-white/70">Commissioned</p>
                  <p className="text-sm font-semibold mt-1">{formatDate(project?.commissioning_date)}</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-3">
                  <p className="text-xs text-white/70">Estimated Decommission</p>
                  <p className="text-sm font-semibold mt-1">{formatDate(project?.estimated_decommission_date)}</p>
                </div>
                <div className="rounded-xl bg-white/10 border border-white/10 p-3">
                  <p className="text-xs text-white/70">Date Logged</p>
                  <p className="text-sm font-semibold mt-1">{formatDate(project?.logging_date)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2"><RiStackLine /> Project Summary</h2>
              <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500">Location</p>
                  <p className="font-semibold text-slate-800 mt-1 flex items-center gap-1"><RiMapPinLine /> {project?.location || 'N/A'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500">Status</p>
                  <p className="font-semibold text-slate-800 mt-1 capitalize">{project?.status || 'Unknown'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500">System Size</p>
                  <p className="font-semibold text-slate-800 mt-1">{formatNumber(summary?.total_project_capacity_kw)} kW</p>
                </div>
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500">Battery Storage</p>
                  <p className="font-semibold text-slate-800 mt-1">{formatNumber(summary?.battery_storage_capacity_kwh)} kWh</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-100 p-3 text-sm">
                <p className="text-slate-500">Client</p>
                <p className="font-semibold text-slate-800 mt-1">{project?.client_name || 'Not disclosed'}</p>
                {project?.description && <p className="text-slate-600 mt-2 leading-relaxed">{project.description}</p>}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2"><RiUserStarLine /> Brand Contact</h2>
              <div className="space-y-3 mt-4 text-sm text-slate-700">
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500">Brand</p>
                  <p className="font-semibold text-slate-900 mt-1">{brand?.name || 'N/A'}</p>
                </div>

                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500 flex items-center gap-1"><RiPhoneLine /> Phone</p>
                  <p className="mt-1 font-medium">{brand?.contact?.phone || 'N/A'}</p>
                </div>

                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500 flex items-center gap-1"><RiMailLine /> Email</p>
                  <p className="mt-1 break-all font-medium">{brand?.contact?.email || 'N/A'}</p>
                </div>

                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500 flex items-center gap-1"><RiMapPinLine /> Address</p>
                  <p className="mt-1 font-medium">{brand?.contact?.address || 'N/A'}</p>
                </div>

                {brand?.website && (
                  <a href={brand.website} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
                    <p className="text-slate-500">Website</p>
                    <p className="mt-1 font-semibold text-forest-900 break-all">{brand.website}</p>
                  </a>
                )}

                {brand?.registration && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-emerald-700 text-xs uppercase tracking-widest">Regulatory Registration</p>
                    <p className="font-semibold text-emerald-900 mt-1">{brand.registration}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Hardware Counts</p>
              <p className="text-sm mt-2 text-slate-700">Panels: <span className="font-semibold">{summary?.total_panels ?? 0}</span></p>
              <p className="text-sm mt-1 text-slate-700">Batteries: <span className="font-semibold">{summary?.total_batteries ?? 0}</span></p>
              <p className="text-sm mt-1 text-slate-700">Inverters: <span className="font-semibold">{summary?.total_inverters ?? 0}</span></p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Key Dates</p>
              <p className="text-sm mt-2 text-slate-700 flex items-center gap-1"><RiCalendarLine /> Commissioned: <span className="font-semibold">{formatDate(project?.commissioning_date)}</span></p>
              <p className="text-sm mt-1 text-slate-700">Decommission ETA: <span className="font-semibold">{formatDate(project?.estimated_decommission_date)}</span></p>
              <p className="text-sm mt-1 text-slate-700">Logged: <span className="font-semibold">{formatDate(project?.logging_date)}</span></p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Verification Meta</p>
              <p className="text-sm mt-2 text-slate-700 flex items-center gap-1"><RiCheckboxCircleLine className="text-emerald-600" /> Verified by: <span className="font-semibold">{verification?.verified_by || 'SolNuv'}</span></p>
              <p className="text-sm mt-1 text-slate-700">Timestamp: <span className="font-semibold">{formatDate(verification?.verified_at)}</span></p>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2"><RiPlantLine /> Manufacturers Used</h2>
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl border border-slate-100 p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Panel Brands</p>
                <p className="text-sm text-slate-700 mt-2">{(manufacturers.panel || []).join(', ') || 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Battery Brands</p>
                <p className="text-sm text-slate-700 mt-2">{(manufacturers.battery || []).join(', ') || 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Inverter Brands</p>
                <p className="text-sm text-slate-700 mt-2">{(manufacturers.inverter || []).join(', ') || 'N/A'}</p>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <EquipmentTable title="Panel Breakdown" rows={equipment.panel || []} unitLabel="W" icon={<RiPlantLine className="text-emerald-700" />} />
            <EquipmentTable title="Battery Breakdown" rows={equipment.battery || []} unitLabel="kWh" icon={<RiStackLine className="text-amber-700" />} />
            <EquipmentTable title="Inverter Breakdown" rows={equipment.inverter || []} unitLabel="kW" icon={<RiToolsLine className="text-sky-700" />} />
          </div>

          <HistoryAppendix history={verification?.history} />

          <div className="text-center pt-2">
            <Link href="/" className="text-sm text-forest-900 font-semibold hover:underline">Back to SolNuv</Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .min-h-screen { min-height: auto !important; }
          .shadow-sm, .shadow-lg { box-shadow: none !important; }
          .border { border-color: #d1d5db !important; }
          .rounded-3xl, .rounded-2xl, .rounded-xl { border-radius: 0 !important; }
        }
      `}</style>
    </>
  );
}
