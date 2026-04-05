import Head from 'next/head';
import { useEffect, useState } from 'react';
import { agentAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { LoadingSpinner } from '../../components/ui/index';
import { MotionSection } from '../../components/PageMotion';
import { RiRobotLine, RiTimeLine, RiCheckLine, RiErrorWarningLine, RiLoader4Line, RiEyeLine } from 'react-icons/ri';

const statusColors = {
  queued: 'bg-slate-100 text-slate-600',
  processing: 'bg-blue-100 text-blue-600',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-600',
};

const statusIcons = {
  queued: RiTimeLine,
  processing: RiLoader4Line,
  completed: RiCheckLine,
  failed: RiErrorWarningLine,
};

export default function AgentTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    agentAPI.getTasks({ status: filter || undefined, page, limit: 20 })
      .then(r => {
        setTasks(r.data?.data || []);
        setTotal(r.data?.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, page]);

  const viewDetail = async (taskId) => {
    try {
      const r = await agentAPI.getTaskDetail(taskId);
      setSelectedTask(r.data?.data || null);
    } catch {
      setSelectedTask(null);
    }
  };

  return (
    <>
      <Head><title>AI Tasks — SolNuv</title></Head>

      <MotionSection className="mb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-900 via-forest-900 to-slate-900 p-6 sm:p-8 text-white">
          <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-violet-300/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.22em] text-white/60 mb-3">AI Intelligence</p>
            <h1 className="font-display font-bold text-3xl sm:text-4xl flex items-center gap-2">
              <RiRobotLine className="text-violet-300" /> Agent Tasks
            </h1>
            <p className="mt-2 text-white/70 text-sm max-w-lg">
              Track async tasks processed by your AI agents — reports, analysis, and automated workflows.
            </p>
          </div>
        </div>
      </MotionSection>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {['', 'queued', 'processing', 'completed', 'failed'].map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(1); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filter === s
                ? 'bg-forest-900 text-white border-forest-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>}

      {!loading && tasks.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <RiRobotLine className="text-4xl mx-auto mb-3 opacity-40" />
          <p className="text-sm">No tasks found</p>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="space-y-3">
          {tasks.map(task => {
            const Icon = statusIcons[task.status] || RiTimeLine;
            return (
              <div key={task.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${statusColors[task.status] || 'bg-slate-100'}`}>
                  <Icon className={`text-lg ${task.status === 'processing' ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{task.task_type}</p>
                  <p className="text-xs text-slate-500">
                    {task.ai_agent_instances?.ai_agent_definitions?.name || 'Agent'} &middot;{' '}
                    {new Date(task.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {task.tokens_used > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">{task.tokens_used} tok</span>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[task.status]}`}>
                    {task.status}
                  </span>
                  <button
                    onClick={() => viewDetail(task.id)}
                    className="p-1.5 text-slate-400 hover:text-forest-900 transition-colors"
                    title="View details"
                  >
                    <RiEyeLine />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500 flex items-center px-2">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={tasks.length < 20}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedTask(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-1">{selectedTask.task_type}</h3>
            <p className="text-xs text-slate-500 mb-4">
              Status: <span className="font-semibold">{selectedTask.status}</span> &middot;
              Tokens: {selectedTask.tokens_used || 0} &middot;
              Retries: {selectedTask.retries || 0}
            </p>
            {selectedTask.output_payload && (
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap break-words font-mono">
                {typeof selectedTask.output_payload === 'string'
                  ? selectedTask.output_payload
                  : JSON.stringify(selectedTask.output_payload, null, 2)}
              </div>
            )}
            {selectedTask.error_message && (
              <div className="bg-red-50 rounded-xl p-4 mt-3 text-sm text-red-700">
                {selectedTask.error_message}
              </div>
            )}
            <button
              onClick={() => setSelectedTask(null)}
              className="mt-4 w-full text-sm font-medium py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

AgentTasks.getLayout = getDashboardLayout;
