import Head from 'next/head';
import { useEffect, useState } from 'react';
import { agentAPI } from '../../services/api';
import { getAdminLayout } from '../../components/Layout';
import AdminRoute from '../../components/AdminRoute';
import { LoadingSpinner } from '../../components/ui/index';
import toast from 'react-hot-toast';
import {
  RiRobotLine, RiSettings3Line, RiTeamLine, RiAlertLine,
  RiBarChartBoxLine, RiDownloadLine, RiRefreshLine, RiCheckLine,
  RiCloseLine, RiSeedlingLine, RiPieChartLine,
} from 'react-icons/ri';

const TABS = ['definitions', 'instances', 'tasks', 'escalations', 'usage'];

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
        active ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}
    >
      <Icon className="text-sm" /> {label}
    </button>
  );
}

function AgentsAdmin() {
  const [tab, setTab] = useState('definitions');
  const [loading, setLoading] = useState(true);
  const [definitions, setDefinitions] = useState([]);
  const [instances, setInstances] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [usage, setUsage] = useState(null);
  const [editDef, setEditDef] = useState(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => { loadTab(); }, [tab]);

  const loadTab = async () => {
    setLoading(true);
    try {
      switch (tab) {
        case 'definitions': {
          const r = await agentAPI.adminGetDefinitions();
          setDefinitions(r.data?.data || []);
          break;
        }
        case 'instances': {
          const r = await agentAPI.adminGetInstances({ limit: 100 });
          setInstances(r.data?.data || []);
          break;
        }
        case 'tasks': {
          const r = await agentAPI.adminGetTasks({ limit: 50 });
          setTasks(r.data?.data || []);
          break;
        }
        case 'escalations': {
          const r = await agentAPI.adminGetEscalations({ status: 'open', limit: 50 });
          setEscalations(r.data?.data || []);
          break;
        }
        case 'usage': {
          const r = await agentAPI.adminGetUsage({});
          setUsage(r.data?.data || null);
          break;
        }
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await agentAPI.adminSeed();
      toast.success('Agent definitions seeded');
      if (tab === 'definitions') loadTab();
    } catch {
      toast.error('Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleActive = async (def) => {
    try {
      await agentAPI.adminUpdateDefinition(def.id, { is_active: !def.is_active });
      toast.success(def.is_active ? 'Agent deactivated' : 'Agent activated');
      loadTab();
    } catch {
      toast.error('Update failed');
    }
  };

  const handleResolveEscalation = async (esc) => {
    try {
      await agentAPI.adminResolveEscalation(esc.id, { status: 'resolved', resolution_notes: 'Resolved via admin dashboard' });
      toast.success('Escalation resolved');
      loadTab();
    } catch {
      toast.error('Failed to resolve');
    }
  };

  const handleExport = async () => {
    try {
      const r = await agentAPI.adminExportTraining({ status: 'completed' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `solnuv-training-${Date.now()}.jsonl`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Training data exported');
    } catch {
      toast.error('Export failed');
    }
  };

  const tierBadge = (tier) => {
    const colors = { internal: 'bg-amber-100 text-amber-700', customer: 'bg-emerald-100 text-emerald-700', general: 'bg-blue-100 text-blue-700' };
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[tier] || 'bg-slate-100 text-slate-600'}`}>{tier}</span>;
  };

  return (
    <AdminRoute>
      <Head><title>AI Agents — Admin — SolNuv</title></Head>

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-900 via-forest-900 to-slate-900 p-6 sm:p-8 text-white mb-6">
        <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/60 mb-3">Super Admin</p>
            <h1 className="font-display font-bold text-3xl sm:text-4xl flex items-center gap-2">
              <RiRobotLine className="text-violet-300" /> AI Agent Management
            </h1>
            <p className="mt-2 text-white/70 text-sm max-w-lg">
              Manage definitions, monitor tasks, resolve escalations, and export training data.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSeed} disabled={seeding} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
              <RiSeedlingLine /> {seeding ? 'Seeding...' : 'Seed'}
            </button>
            <button onClick={handleExport} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
              <RiDownloadLine /> Export Training
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton active={tab === 'definitions'} onClick={() => setTab('definitions')} icon={RiSettings3Line} label="Definitions" />
        <TabButton active={tab === 'instances'} onClick={() => setTab('instances')} icon={RiTeamLine} label="Instances" />
        <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')} icon={RiBarChartBoxLine} label="Task Queue" />
        <TabButton active={tab === 'escalations'} onClick={() => setTab('escalations')} icon={RiAlertLine} label="Escalations" />
        <TabButton active={tab === 'usage'} onClick={() => setTab('usage')} icon={RiPieChartLine} label="Token Usage" />
        <button onClick={loadTab} className="ml-auto text-xs text-slate-500 hover:text-forest-900 flex items-center gap-1 transition-colors">
          <RiRefreshLine /> Refresh
        </button>
      </div>

      {loading && <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}

      {/* Definitions tab */}
      {!loading && tab === 'definitions' && (
        <div className="space-y-3">
          {definitions.map(def => (
            <div key={def.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  {def.name} {tierBadge(def.tier)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{def.slug} &middot; {def.provider_slug} &middot; min: {def.plan_minimum}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{def.description}</p>
              </div>
              <button
                onClick={() => handleToggleActive(def)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  def.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-red-50 text-red-600 border-red-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                }`}
              >
                {def.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
          {definitions.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No agent definitions. Click Seed to create defaults.</p>
          )}
        </div>
      )}

      {/* Instances tab */}
      {!loading && tab === 'instances' && (
        <div className="space-y-3">
          {instances.map(inst => (
            <div key={inst.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {inst.ai_agent_definitions?.name || 'Agent'} {tierBadge(inst.ai_agent_definitions?.tier)}
                </p>
                <p className="text-xs text-slate-500">
                  Company: {inst.companies?.name || 'Shared'} &middot;
                  Plan: {inst.companies?.subscription_plan || 'N/A'}
                </p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${inst.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                {inst.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
          {instances.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No agent instances</p>}
        </div>
      )}

      {/* Tasks tab */}
      {!loading && tab === 'tasks' && (
        <div className="space-y-3">
          {tasks.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{t.task_type}</p>
                  <p className="text-xs text-slate-500">
                    {t.ai_agent_instances?.ai_agent_definitions?.name || 'Agent'} &middot;
                    {new Date(t.created_at).toLocaleString('en-NG')}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  t.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                    : t.status === 'failed' ? 'bg-red-100 text-red-600'
                      : 'bg-blue-100 text-blue-600'
                }`}>{t.status}</span>
                {t.tokens_used > 0 && <span className="text-[10px] text-slate-400 font-mono">{t.tokens_used} tok</span>}
              </div>
              {t.error_message && <p className="text-xs text-red-500 mt-2">{t.error_message}</p>}
            </div>
          ))}
          {tasks.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No tasks in queue</p>}
        </div>
      )}

      {/* Escalations tab */}
      {!loading && tab === 'escalations' && (
        <div className="space-y-3">
          {escalations.map(esc => (
            <div key={esc.id} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <RiAlertLine className={`text-lg flex-shrink-0 ${esc.severity === 'critical' ? 'text-red-500' : esc.severity === 'high' ? 'text-amber-500' : 'text-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{esc.reason}</p>
                  <p className="text-xs text-slate-500">{new Date(esc.created_at).toLocaleString('en-NG')} &middot; {esc.severity}</p>
                </div>
                <button
                  onClick={() => handleResolveEscalation(esc)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                >
                  <RiCheckLine /> Resolve
                </button>
              </div>
            </div>
          ))}
          {escalations.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No open escalations</p>}
        </div>
      )}

      {/* Usage tab */}
      {!loading && tab === 'usage' && usage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(usage).map(([key, val]) => (
            <div key={key} className="bg-white rounded-xl border border-slate-100 p-4">
              <p className="text-xs text-slate-500 font-medium">{key.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {typeof val === 'number' ? val.toLocaleString() : String(val)}
              </p>
            </div>
          ))}
        </div>
      )}
      {!loading && tab === 'usage' && !usage && (
        <p className="text-center text-sm text-slate-400 py-8">No usage data available</p>
      )}
    </AdminRoute>
  );
}

AgentsAdmin.getLayout = getAdminLayout;
export default AgentsAdmin;
