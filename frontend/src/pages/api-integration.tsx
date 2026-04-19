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
} from 'react-icons/ri';
import { apiKeyAPI } from '../services/api';
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
