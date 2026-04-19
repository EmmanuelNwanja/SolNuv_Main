import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  RiAddLine,
  RiDeleteBin6Line,
  RiFileCopy2Line,
  RiKey2Line,
  RiShieldCheckLine,
  RiCloseLine,
  RiSendPlaneLine,
  RiLinksLine,
  RiPlayCircleLine,
  RiHistoryLine,
} from 'react-icons/ri';
import { apiKeyAPI } from '../services/api';
import { integrationAPI } from '../services/api';
import { getDashboardLayout } from '../components/Layout';
import { MotionSection } from '../components/PageMotion';
import { LoadingSpinner } from '../components/ui';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface ExternalIntegration {
  id: string;
  name: string;
  target_system: 'nerc' | 'nesrea' | 'custom';
  base_url: string;
  auth_type: 'none' | 'bearer' | 'api_key' | 'basic';
  auth_header_name: string | null;
  auth_secret: string | null;
  auth_username: string | null;
  endpoints: Record<string, string>;
  field_mappings?: Record<string, unknown>;
  is_active: boolean;
  timeout_ms: number;
  last_tested_at: string | null;
  last_test_status: string | null;
}

interface IntegrationLogRow {
  id: string;
  event_type: string;
  request_path: string | null;
  response_status: number | null;
  error_message: string | null;
  created_at: string;
}

const AVAILABLE_SCOPES = [
  { id: 'simulate:preview', label: 'Simulation preview', hint: 'POST /v1/public/simulate/preview' },
  { id: 'tariffs:read', label: 'Tariff catalogue', hint: 'GET /v1/public/tariffs' },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

export default function ApiIntegrationPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScopes, setNewScopes] = useState<string[]>(['simulate:preview']);
  const [freshSecret, setFreshSecret] = useState<{ secret: string; name: string } | null>(null);
  const [integrations, setIntegrations] = useState<ExternalIntegration[]>([]);
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [logs, setLogs] = useState<IntegrationLogRow[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    target_system: 'custom',
    base_url: '',
    auth_type: 'none',
    auth_header_name: 'x-api-key',
    auth_secret: '',
    auth_username: '',
    project_registration_path: '/project-registrations',
    compliance_report_path: '/compliance-reports',
    timeout_ms: 15000,
    is_active: true,
  });
  const [dispatchForm, setDispatchForm] = useState({
    integration_id: '',
    mode: 'project_registration',
    path: '',
    payload: '{\n  "project_id": "your-project-id",\n  "reference": "optional-reference"\n}',
  });
  const [mappingIntegrationId, setMappingIntegrationId] = useState('');
  const [mappingJson, setMappingJson] = useState(`{
  "project_registration": {
    "registration.projectId": "project.id",
    "registration.projectName": "project.name",
    "registration.capacityKw": "simulation.pv_capacity_kwp",
    "registration.submittedAt": { "$now": true }
  },
  "compliance_report": {
    "report.projectId": "project.id",
    "report.totalGenerationKwh": "results.generation_kwh",
    "report.complianceStatus": "compliance.status"
  }
}`);
  const [savingMappings, setSavingMappings] = useState(false);
  const [previewingDispatch, setPreviewingDispatch] = useState(false);
  const [dispatchPreview, setDispatchPreview] = useState<{
    raw_payload: unknown;
    transformed_payload: unknown;
    outbound_request: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body: unknown;
      body_json: string;
    };
  } | null>(null);

  const apiBaseHint = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'https://api.solnuv.com';
    return base.replace(/\/$/, '');
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await apiKeyAPI.list();
      setKeys((data?.data || []) as ApiKey[]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadIntegrations = async () => {
    setIntegrationLoading(true);
    try {
      const { data } = await integrationAPI.list();
      const rows = (data?.data || []) as ExternalIntegration[];
      setIntegrations(rows);
      setDispatchForm((prev) => ({ ...prev, integration_id: prev.integration_id || rows[0]?.id || '' }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load external integrations');
    } finally {
      setIntegrationLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogLoading(true);
    try {
      const { data } = await integrationAPI.listLogs({ limit: 10 });
      setLogs((data?.data || []) as IntegrationLogRow[]);
    } catch {
      toast.error('Failed to load integration logs');
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    void loadIntegrations();
    void loadLogs();
  }, []);

  useEffect(() => {
    if (!mappingIntegrationId && integrations.length > 0) {
      setMappingIntegrationId(integrations[0].id);
      const initial = integrations[0].field_mappings || {};
      setMappingJson(JSON.stringify(initial, null, 2));
    }
  }, [integrations, mappingIntegrationId]);

  const toggleScope = (id: string) => {
    setNewScopes((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    if (newName.trim().length < 3) {
      toast.error('Give the key a descriptive name (at least 3 characters).');
      return;
    }
    if (newScopes.length === 0) {
      toast.error('Pick at least one scope.');
      return;
    }
    setCreating(true);
    try {
      const { data } = await apiKeyAPI.create({ name: newName.trim(), scopes: newScopes });
      const payload = data?.data;
      if (payload?.secret) {
        setFreshSecret({ secret: payload.secret, name: payload.key?.name || newName.trim() });
      }
      setNewName('');
      setNewScopes(['simulate:preview']);
      await load();
      toast.success('API key created — copy the secret now.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? Any clients using it will immediately stop working.')) return;
    try {
      await apiKeyAPI.revoke(id);
      toast.success('API key revoked');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to revoke key');
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed — select the text manually.');
    }
  };

  const handleSaveIntegration = async () => {
    if (!form.name.trim() || !form.base_url.trim()) {
      toast.error('Name and base URL are required');
      return;
    }
    setSavingIntegration(true);
    try {
      await integrationAPI.create({
        name: form.name.trim(),
        target_system: form.target_system,
        base_url: form.base_url.trim(),
        auth_type: form.auth_type,
        auth_header_name: form.auth_header_name || null,
        auth_secret: form.auth_secret || null,
        auth_username: form.auth_username || null,
        timeout_ms: form.timeout_ms,
        is_active: form.is_active,
        endpoints: {
          project_registration_path: form.project_registration_path || null,
          compliance_report_path: form.compliance_report_path || null,
        },
      });
      toast.success('External integration created');
      setForm({
        name: '',
        target_system: 'custom',
        base_url: '',
        auth_type: 'none',
        auth_header_name: 'x-api-key',
        auth_secret: '',
        auth_username: '',
        project_registration_path: '/project-registrations',
        compliance_report_path: '/compliance-reports',
        timeout_ms: 15000,
        is_active: true,
      });
      await loadIntegrations();
      await loadLogs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create integration');
    } finally {
      setSavingIntegration(false);
    }
  };

  const handleTest = async (id: string) => {
    try {
      await integrationAPI.test(id);
      toast.success('Test request sent');
      await loadIntegrations();
      await loadLogs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Integration test failed');
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    if (!confirm('Delete this integration?')) return;
    try {
      await integrationAPI.delete(id);
      toast.success('Integration removed');
      await loadIntegrations();
      await loadLogs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete integration');
    }
  };

  const handleDispatch = async () => {
    if (!dispatchForm.integration_id) {
      toast.error('Select an integration');
      return;
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = dispatchForm.payload.trim() ? JSON.parse(dispatchForm.payload) : {};
    } catch {
      toast.error('Payload must be valid JSON');
      return;
    }
    try {
      await integrationAPI.dispatch(dispatchForm.integration_id, {
        mode: dispatchForm.mode,
        path: dispatchForm.path || undefined,
        payload,
      });
      toast.success('Dispatch completed');
      await loadLogs();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Dispatch failed');
    }
  };

  const handlePreviewDispatch = async () => {
    if (!dispatchForm.integration_id) {
      toast.error('Select an integration');
      return;
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = dispatchForm.payload.trim() ? JSON.parse(dispatchForm.payload) : {};
    } catch {
      toast.error('Payload must be valid JSON');
      return;
    }
    setPreviewingDispatch(true);
    try {
      const { data } = await integrationAPI.previewDispatch(dispatchForm.integration_id, {
        mode: dispatchForm.mode,
        path: dispatchForm.path || undefined,
        payload,
      });
      setDispatchPreview(data?.data || null);
      toast.success('Preview generated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate preview');
    } finally {
      setPreviewingDispatch(false);
    }
  };

  const handleSaveMappings = async () => {
    if (!mappingIntegrationId) {
      toast.error('Select an integration first');
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = mappingJson.trim() ? JSON.parse(mappingJson) : {};
    } catch {
      toast.error('Field mappings must be valid JSON');
      return;
    }
    setSavingMappings(true);
    try {
      await integrationAPI.update(mappingIntegrationId, { field_mappings: parsed });
      toast.success('Field mappings updated');
      await loadIntegrations();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save field mappings');
    } finally {
      setSavingMappings(false);
    }
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => !!k.revoked_at);

  return (
    <>
      <Head>
        <title>API integration — SolNuv</title>
      </Head>
      <MotionSection>
        <div className="max-w-5xl mx-auto">
          <header className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <RiKey2Line className="text-2xl text-forest-700 dark:text-forest-300" />
              <h1 className="text-2xl font-bold text-forest-900 dark:text-white">API integration</h1>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
              Call the SolNuv simulation engine from your ERP, data warehouse, or internal tools.
              Authenticate with an API key, then hit{' '}
              <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{apiBaseHint}/v1/public/*</code>.
              Keys are hashed on our side — we can only show each secret once, at creation.
            </p>
          </header>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <RiAddLine /> Create a new key
            </h2>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  className="input w-full"
                  placeholder="e.g. Internal ERP — production"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="btn-primary w-full py-2 flex items-center justify-center gap-2"
                >
                  {creating ? <LoadingSpinner className="w-4 h-4" /> : <RiAddLine />}
                  Create key
                </button>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Scopes</div>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_SCOPES.map((s) => {
                  const on = newScopes.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleScope(s.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        on
                          ? 'bg-forest-600 text-white border-forest-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                      }`}
                      title={s.hint}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden mb-6">
            <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <RiShieldCheckLine /> Active keys
              </h2>
              <span className="text-xs text-slate-500">{activeKeys.length} active</span>
            </header>
            {loading ? (
              <div className="p-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : activeKeys.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No active keys yet. Create your first key above.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-left px-4 py-2">Prefix</th>
                    <th className="text-left px-4 py-2">Scopes</th>
                    <th className="text-left px-4 py-2">Last used</th>
                    <th className="text-left px-4 py-2">Created</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {activeKeys.map((k) => (
                    <tr key={k.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3 font-medium">{k.name}</td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs">{k.prefix}…</code>
                      </td>
                      <td className="px-4 py-3 text-xs">{(k.scopes || []).join(', ') || '—'}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(k.last_used_at)}</td>
                      <td className="px-4 py-3 text-xs">{formatDate(k.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevoke(k.id)}
                          className="text-red-600 hover:text-red-700 text-xs inline-flex items-center gap-1"
                        >
                          <RiDeleteBin6Line /> Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {revokedKeys.length > 0 && (
            <details className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-4 mb-6">
              <summary className="text-sm font-medium cursor-pointer">
                Revoked keys ({revokedKeys.length})
              </summary>
              <ul className="mt-3 space-y-1 text-xs text-slate-500">
                {revokedKeys.map((k) => (
                  <li key={k.id}>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{k.name}</span>{' '}
                    · revoked {formatDate(k.revoked_at)}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-lg font-semibold mb-2">Quickstart</h2>
            <p className="text-xs text-slate-500 mb-3">
              Every public endpoint accepts the key as{' '}
              <code className="px-1 bg-slate-100 dark:bg-slate-800 rounded">Authorization: Bearer sk_live_…</code>
              . Responses use the standard SolNuv envelope.
            </p>
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto">
{`curl -X POST ${apiBaseHint}/v1/public/simulate/preview \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lat": 6.5,
    "lon": 3.4,
    "pv_capacity_kwp": 100,
    "annual_load_kwh": 180000,
    "capex_total": 80000000,
    "om_annual": 1600000,
    "discount_rate_pct": 12,
    "tariff_escalation_pct": 10,
    "analysis_period_years": 25
  }'`}
            </pre>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 mt-6">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><RiLinksLine /> External integrations</h2>
            <p className="text-xs text-slate-500 mb-4">
              Configure outbound API integrations so SolNuv can push project registrations and compliance reports directly to regulators/partners (e.g., NERC, NESREA) at API level.
            </p>

            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <input className="input" placeholder="Integration name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <input className="input" placeholder="Base URL (e.g. https://portal.nerc.gov.ng/api)" value={form.base_url} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} />
              <select className="input" value={form.target_system} onChange={(e) => setForm((f) => ({ ...f, target_system: e.target.value as any }))}>
                <option value="custom">Custom</option>
                <option value="nerc">NERC</option>
                <option value="nesrea">NESREA</option>
              </select>
              <select className="input" value={form.auth_type} onChange={(e) => setForm((f) => ({ ...f, auth_type: e.target.value as any }))}>
                <option value="none">No auth</option>
                <option value="bearer">Bearer token</option>
                <option value="api_key">API key header</option>
                <option value="basic">Basic auth</option>
              </select>
              {form.auth_type === 'api_key' && (
                <input className="input" placeholder="Header name (x-api-key)" value={form.auth_header_name} onChange={(e) => setForm((f) => ({ ...f, auth_header_name: e.target.value }))} />
              )}
              {form.auth_type === 'basic' && (
                <input className="input" placeholder="Username" value={form.auth_username} onChange={(e) => setForm((f) => ({ ...f, auth_username: e.target.value }))} />
              )}
              {form.auth_type !== 'none' && (
                <input className="input" placeholder="Secret/token" value={form.auth_secret} onChange={(e) => setForm((f) => ({ ...f, auth_secret: e.target.value }))} />
              )}
              <input className="input" placeholder="Project registration path" value={form.project_registration_path} onChange={(e) => setForm((f) => ({ ...f, project_registration_path: e.target.value }))} />
              <input className="input" placeholder="Compliance report path" value={form.compliance_report_path} onChange={(e) => setForm((f) => ({ ...f, compliance_report_path: e.target.value }))} />
            </div>
            <button onClick={handleSaveIntegration} disabled={savingIntegration} className="btn-primary px-4 py-2 text-sm">
              {savingIntegration ? 'Saving...' : 'Save integration'}
            </button>

            <div className="mt-5 space-y-2">
              {integrationLoading ? (
                <p className="text-xs text-slate-500">Loading integrations...</p>
              ) : integrations.length === 0 ? (
                <p className="text-xs text-slate-500">No external integrations configured yet.</p>
              ) : (
                integrations.map((i) => (
                  <div key={i.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{i.name}</p>
                        <p className="text-xs text-slate-500">{i.target_system.toUpperCase()} · {i.base_url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleTest(i.id)} className="text-xs px-2 py-1 rounded border inline-flex items-center gap-1"><RiPlayCircleLine /> Test</button>
                        <button onClick={() => handleDeleteIntegration(i.id)} className="text-xs px-2 py-1 rounded border text-red-600">Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 mt-6">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><RiSendPlaneLine /> Dispatch to external API</h2>
            <p className="text-xs text-slate-500 mb-3">Trigger project registration or compliance report dispatch using any active integration.</p>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <select className="input" value={dispatchForm.integration_id} onChange={(e) => setDispatchForm((f) => ({ ...f, integration_id: e.target.value }))}>
                <option value="">Select integration</option>
                {integrations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <select className="input" value={dispatchForm.mode} onChange={(e) => setDispatchForm((f) => ({ ...f, mode: e.target.value }))}>
                <option value="project_registration">Project registration</option>
                <option value="compliance_report">Compliance report</option>
                <option value="custom">Custom</option>
              </select>
              <input className="input" placeholder="Custom path (optional)" value={dispatchForm.path} onChange={(e) => setDispatchForm((f) => ({ ...f, path: e.target.value }))} />
            </div>
            <textarea className="input font-mono text-xs min-h-[140px]" value={dispatchForm.payload} onChange={(e) => setDispatchForm((f) => ({ ...f, payload: e.target.value }))} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={handlePreviewDispatch} disabled={previewingDispatch} className="btn-outline px-4 py-2 text-sm inline-flex items-center gap-2">
                {previewingDispatch ? 'Preparing preview...' : 'Preview mapping'}
              </button>
              <button onClick={handleDispatch} className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2">
                <RiSendPlaneLine /> Dispatch now
              </button>
            </div>
            {dispatchPreview && (
              <div className="mt-4 grid md:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Raw payload</p>
                  <pre className="text-xs bg-slate-950 text-slate-100 rounded-lg p-3 max-h-72 overflow-auto">{JSON.stringify(dispatchPreview.raw_payload, null, 2)}</pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Transformed payload</p>
                  <pre className="text-xs bg-slate-950 text-slate-100 rounded-lg p-3 max-h-72 overflow-auto">{JSON.stringify(dispatchPreview.transformed_payload, null, 2)}</pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Final outbound request body</p>
                  <pre className="text-xs bg-slate-950 text-slate-100 rounded-lg p-3 max-h-72 overflow-auto">{dispatchPreview.outbound_request?.body_json || "{}"}</pre>
                  <p className="text-[11px] text-slate-500 mt-2 break-all">
                    {dispatchPreview.outbound_request?.method} {dispatchPreview.outbound_request?.url}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 mt-6">
            <h2 className="text-lg font-semibold mb-2">Field Mapping Templates</h2>
            <p className="text-xs text-slate-500 mb-3">
              Map SolNuv payload fields to the target API schema per event type. Keys are target fields (dot-path supported). Values can be source path strings or directive objects such as
              <code className="mx-1 px-1 rounded bg-slate-100 dark:bg-slate-800">{`{ "$path": "project.id" }`}</code>,
              <code className="mx-1 px-1 rounded bg-slate-100 dark:bg-slate-800">{`{ "$literal": "value" }`}</code>, and
              <code className="mx-1 px-1 rounded bg-slate-100 dark:bg-slate-800">{`{ "$now": true }`}</code>.
            </p>
            <div className="mb-3">
              <select
                className="input max-w-sm"
                value={mappingIntegrationId}
                onChange={(e) => {
                  const id = e.target.value;
                  setMappingIntegrationId(id);
                  const selected = integrations.find((x) => x.id === id);
                  setMappingJson(JSON.stringify(selected?.field_mappings || {}, null, 2));
                }}
              >
                <option value="">Select integration</option>
                {integrations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <textarea
              className="input font-mono text-xs min-h-[220px]"
              value={mappingJson}
              onChange={(e) => setMappingJson(e.target.value)}
            />
            <button
              onClick={handleSaveMappings}
              disabled={savingMappings}
              className="btn-primary px-4 py-2 mt-3 text-sm"
            >
              {savingMappings ? 'Saving...' : 'Save mappings'}
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 mt-6">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><RiHistoryLine /> Integration dispatch logs</h2>
            {logLoading ? (
              <p className="text-xs text-slate-500">Loading logs...</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-slate-500">No dispatch logs yet.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <p className="text-sm font-medium">{log.event_type} {log.request_path ? `· ${log.request_path}` : ''}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(log.created_at).toLocaleString()} · status: {log.response_status ?? '—'} {log.error_message ? `· error: ${log.error_message}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </MotionSection>

      {freshSecret && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setFreshSecret(null)}
              className="absolute top-3 right-3 text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              <RiCloseLine className="text-xl" />
            </button>
            <h3 className="text-lg font-bold text-forest-900 dark:text-white mb-1">
              Copy your new API key
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              This is the only time we will show <strong>{freshSecret.name}</strong>&rsquo;s secret.
              Store it securely (a password manager or secret store), then click &ldquo;I&rsquo;ve saved it&rdquo;.
            </p>
            <div className="flex items-center gap-2 bg-slate-950 text-green-300 font-mono text-xs p-3 rounded-lg overflow-x-auto">
              <span className="flex-1 break-all">{freshSecret.secret}</span>
              <button
                onClick={() => copy(freshSecret.secret)}
                className="text-white bg-forest-600 hover:bg-forest-700 px-2 py-1 rounded text-xs inline-flex items-center gap-1"
              >
                <RiFileCopy2Line /> Copy
              </button>
            </div>
            <button
              onClick={() => setFreshSecret(null)}
              className="btn-primary w-full mt-4"
            >
              I&rsquo;ve saved it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

ApiIntegrationPage.getLayout = getDashboardLayout;
