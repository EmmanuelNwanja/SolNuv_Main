import Head from 'next/head';
import { useEffect, useState, useCallback } from 'react';
import { agentAPI } from '../../services/api';
import { getAdminLayout } from '../../components/Layout';
import AdminRoute from '../../components/AdminRoute';
import { LoadingSpinner } from '../../components/ui/index';
import toast from 'react-hot-toast';
import {
  RiRobotLine, RiSettings3Line, RiTeamLine, RiAlertLine,
  RiBarChartBoxLine, RiDownloadLine, RiRefreshLine, RiCheckLine,
  RiCloseLine, RiSeedlingLine, RiPieChartLine, RiEditLine,
  RiAddLine, RiDeleteBinLine, RiArrowLeftLine, RiSaveLine,
  RiBookOpenLine, RiFileTextLine, RiToggleLine,
} from 'react-icons/ri';

const TABS = ['definitions', 'instances', 'tasks', 'escalations', 'usage'];
const PLAN_OPTIONS = ['basic', 'pro', 'elite', 'enterprise'];
const PROVIDER_OPTIONS = ['gemini', 'groq'];

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

/* ─── Knowledge Document Editor (modal) ─── */
function KnowledgeDocModal({ doc, onSave, onClose, saving }) {
  const [title, setTitle] = useState(doc?.title || '');
  const [content, setContent] = useState(doc?.content || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">{doc ? 'Edit Document' : 'Add Knowledge Document'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><RiCloseLine className="text-lg" /></button>
        </div>
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Nigeria Solar Irradiance Data"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Content <span className="text-slate-400">({content.length.toLocaleString()} / 50,000 chars)</span></label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={14} placeholder="Paste knowledge content here..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 resize-y" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
          <button onClick={onClose} className="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => onSave({ title: title.trim(), content: content.trim() })} disabled={saving || !title.trim() || !content.trim()}
            className="text-xs px-4 py-2 rounded-lg bg-forest-900 text-white hover:bg-forest-800 disabled:opacity-50 flex items-center gap-1.5">
            <RiSaveLine /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Agent Detail / Edit Panel ─── */
function AgentEditor({ defId, onBack, onUpdated }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [def, setDef] = useState(null);
  const [form, setForm] = useState({});
  const [knowledgeModal, setKnowledgeModal] = useState(null); // null | 'new' | {doc}
  const [savingKb, setSavingKb] = useState(false);

  const loadDef = useCallback(async () => {
    setLoading(true);
    try {
      const r = await agentAPI.adminGetDefinition(defId);
      const d = r.data?.data;
      setDef(d);
      setForm({
        name: d.name || '',
        description: d.description || '',
        system_prompt: d.system_prompt || '',
        custom_instructions: d.custom_instructions || '',
        temperature: d.temperature ?? 0.7,
        provider_slug: d.provider_slug || 'gemini',
        plan_minimum: d.plan_minimum || 'basic',
        capabilities: Array.isArray(d.capabilities) ? d.capabilities.join(', ') : '',
        is_active: d.is_active,
      });
    } catch {
      toast.error('Failed to load agent definition');
      onBack();
    } finally {
      setLoading(false);
    }
  }, [defId, onBack]);

  useEffect(() => { loadDef(); }, [loadDef]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const caps = form.capabilities.split(',').map(c => c.trim()).filter(Boolean);
      await agentAPI.adminUpdateDefinition(defId, {
        name: form.name,
        description: form.description,
        system_prompt: form.system_prompt,
        custom_instructions: form.custom_instructions,
        temperature: parseFloat(form.temperature),
        provider_slug: form.provider_slug,
        plan_minimum: form.plan_minimum,
        capabilities: caps,
        is_active: form.is_active,
      });
      toast.success('Agent definition updated');
      onUpdated();
      loadDef();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddKnowledge = async ({ title, content }) => {
    setSavingKb(true);
    try {
      await agentAPI.adminAddKnowledge(defId, { title, content });
      toast.success('Knowledge document added');
      setKnowledgeModal(null);
      loadDef();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add knowledge');
    } finally {
      setSavingKb(false);
    }
  };

  const handleUpdateKnowledge = async ({ title, content }) => {
    if (!knowledgeModal?.id) return;
    setSavingKb(true);
    try {
      await agentAPI.adminUpdateKnowledge(defId, knowledgeModal.id, { title, content });
      toast.success('Knowledge document updated');
      setKnowledgeModal(null);
      loadDef();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update knowledge');
    } finally {
      setSavingKb(false);
    }
  };

  const handleRemoveKnowledge = async (docId, docTitle) => {
    if (!confirm(`Remove knowledge document "${docTitle}"?`)) return;
    try {
      await agentAPI.adminRemoveKnowledge(defId, docId);
      toast.success('Knowledge document removed');
      loadDef();
    } catch {
      toast.error('Failed to remove knowledge');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;
  if (!def) return null;

  const knowledge = Array.isArray(def.knowledge_base) ? def.knowledge_base : [];

  return (
    <div>
      {/* Back button & header */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-forest-900 mb-4 transition-colors">
        <RiArrowLeftLine /> Back to definitions
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        {/* Agent header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <RiRobotLine className="text-violet-500" /> {def.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{def.slug} &middot; v{def.version || 1} &middot; {def.tier} tier</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
              form.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
            }`}
          >
            <RiToggleLine /> {form.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basic fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
              <select value={form.provider_slug} onChange={e => setForm(f => ({ ...f, provider_slug: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500">
                {PROVIDER_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan Minimum</label>
              <select value={form.plan_minimum} onChange={e => setForm(f => ({ ...f, plan_minimum: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500">
                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Temperature ({form.temperature})</label>
              <input type="range" min="0" max="2" step="0.1" value={form.temperature}
                onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))}
                className="w-full mt-1 accent-forest-600" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Capabilities <span className="text-slate-400">(comma-separated)</span></label>
            <input value={form.capabilities} onChange={e => setForm(f => ({ ...f, capabilities: e.target.value }))}
              placeholder="solar_sizing, financial_analysis, report_generation"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500" />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
              <RiFileTextLine className="text-violet-500" /> System Prompt (Core)
            </label>
            <textarea value={form.system_prompt} onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))} rows={8}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 resize-y" />
          </div>

          {/* Custom Instructions */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
              <RiEditLine className="text-amber-500" /> Custom Instructions (Non-Core)
            </label>
            <p className="text-[11px] text-slate-400 mb-1.5">Added after the core prompt. Use for behavioural overrides, tone, formatting rules, etc.</p>
            <textarea value={form.custom_instructions} onChange={e => setForm(f => ({ ...f, custom_instructions: e.target.value }))} rows={5}
              placeholder="e.g. Always respond in a friendly, professional tone. Include cost estimates in Naira..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500 resize-y" />
          </div>

          {/* Knowledge Base */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <RiBookOpenLine className="text-forest-600" /> Knowledge Base ({knowledge.length} document{knowledge.length !== 1 ? 's' : ''})
              </label>
              <button onClick={() => setKnowledgeModal('new')}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-forest-50 text-forest-700 border border-forest-200 hover:bg-forest-100 flex items-center gap-1 transition-colors">
                <RiAddLine /> Add Document
              </button>
            </div>
            {knowledge.length === 0 && (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-4 text-center">
                No knowledge documents yet. Add documents to improve this agent&apos;s contextual reasoning.
              </p>
            )}
            <div className="space-y-2">
              {knowledge.map(doc => (
                <div key={doc.id} className="bg-slate-50 rounded-lg p-3 flex items-start gap-3 group">
                  <RiFileTextLine className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{doc.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{doc.content}</p>
                    {doc.added_at && <p className="text-[10px] text-slate-300 mt-1">Added {new Date(doc.added_at).toLocaleDateString('en-NG')}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setKnowledgeModal(doc)} className="text-xs p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-forest-700" title="Edit">
                      <RiEditLine />
                    </button>
                    <button onClick={() => handleRemoveKnowledge(doc.id, doc.title)} className="text-xs p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-red-600" title="Remove">
                      <RiDeleteBinLine />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button onClick={handleSave} disabled={saving}
              className="text-sm px-5 py-2.5 rounded-xl bg-forest-900 text-white hover:bg-forest-800 disabled:opacity-50 flex items-center gap-2 font-medium transition-colors">
              <RiSaveLine /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Knowledge modal */}
      {knowledgeModal && (
        <KnowledgeDocModal
          doc={knowledgeModal === 'new' ? null : knowledgeModal}
          saving={savingKb}
          onClose={() => setKnowledgeModal(null)}
          onSave={knowledgeModal === 'new' ? handleAddKnowledge : handleUpdateKnowledge}
        />
      )}
    </div>
  );
}

/* ─── Main Page ─── */
function AgentsAdmin() {
  const [tab, setTab] = useState('definitions');
  const [loading, setLoading] = useState(true);
  const [definitions, setDefinitions] = useState([]);
  const [instances, setInstances] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [usage, setUsage] = useState(null);
  const [editDefId, setEditDefId] = useState(null);
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

  const handleToggleActive = async (e, def) => {
    e.stopPropagation();
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
              Manage definitions, edit prompts &amp; knowledge, monitor tasks, resolve escalations, and export training data.
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
      {!editDefId && (
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
      )}

      {/* Agent Editor (full-page takeover when editing) */}
      {editDefId && (
        <AgentEditor
          defId={editDefId}
          onBack={() => { setEditDefId(null); loadTab(); }}
          onUpdated={loadTab}
        />
      )}

      {!editDefId && loading && <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}

      {/* Definitions tab */}
      {!editDefId && !loading && tab === 'definitions' && (
        <div className="space-y-3">
          {definitions.map(def => (
            <div key={def.id} onClick={() => setEditDefId(def.id)}
              className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4 cursor-pointer hover:border-forest-200 hover:shadow-sm transition-all group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  {def.name} {tierBadge(def.tier)}
                  {def.version > 1 && <span className="text-[10px] text-slate-400 font-normal">v{def.version}</span>}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{def.slug} &middot; {def.provider_slug} &middot; min: {def.plan_minimum}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{def.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <RiEditLine /> Edit
                </span>
                <button
                  onClick={(e) => handleToggleActive(e, def)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    def.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-red-50 text-red-600 border-red-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                  }`}
                >
                  {def.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          ))}
          {definitions.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">No agent definitions. Click Seed to create defaults.</p>
          )}
        </div>
      )}

      {/* Instances tab */}
      {!editDefId && !loading && tab === 'instances' && (
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
      {!editDefId && !loading && tab === 'tasks' && (
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
      {!editDefId && !loading && tab === 'escalations' && (
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
      {!editDefId && !loading && tab === 'usage' && usage && (
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
      {!editDefId && !loading && tab === 'usage' && !usage && (
        <p className="text-center text-sm text-slate-400 py-8">No usage data available</p>
      )}
    </AdminRoute>
  );
}

AgentsAdmin.getLayout = getAdminLayout;
export default AgentsAdmin;
