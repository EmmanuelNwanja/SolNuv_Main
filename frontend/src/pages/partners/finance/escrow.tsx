import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiPauseCircleFill,
  RiRefreshLine,
  RiShieldCheckLine,
} from "react-icons/ri";
import { getPartnerFinancierLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";

type DecisionType = "RELEASE_APPROVED" | "PARTIAL_RELEASE" | "HOLD";

interface EscrowDecision {
  id: string;
  organization_id: string;
  project_id: string;
  escrow_account_id: string | null;
  decision_type: DecisionType;
  approved_release_amount_ngn: number | null;
  approved_hold_amount_ngn: number | null;
  failed_conditions: string[] | null;
  rationale: string | null;
  policy_version: string | null;
  condition_flags: Record<string, unknown> | null;
  tx_hash: string | null;
  chain_id: string | null;
  network_name: string | null;
  block_number: number | null;
  decided_at: string | null;
  created_at: string | null;
}

const STATUS_FILTERS: { id: "all" | DecisionType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "RELEASE_APPROVED", label: "Released" },
  { id: "PARTIAL_RELEASE", label: "Partial" },
  { id: "HOLD", label: "Held" },
];

function formatNgn(value: number | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function statusBadge(type: DecisionType) {
  switch (type) {
    case "RELEASE_APPROVED":
      return {
        label: "Released",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
        Icon: RiCheckboxCircleFill,
      };
    case "PARTIAL_RELEASE":
      return {
        label: "Partial release",
        className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
        Icon: RiErrorWarningFill,
      };
    case "HOLD":
    default:
      return {
        label: "On hold",
        className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
        Icon: RiPauseCircleFill,
      };
  }
}

export default function PartnerFinanceEscrowPage() {
  const [decisions, setDecisions] = useState<EscrowDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (filter !== "all") params.status = filter;
      const { data } = await partnerAPI.listFinancierEscrowDecisions(params);
      const rows = (data?.data?.decisions || []) as EscrowDecision[];
      setDecisions(Array.isArray(rows) ? rows : []);
    } catch {
      toast.error("Failed to load escrow decisions");
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    let released = 0;
    let held = 0;
    let partial = 0;
    for (const d of decisions) {
      released += Number(d.approved_release_amount_ngn) || 0;
      held += Number(d.approved_hold_amount_ngn) || 0;
      if (d.decision_type === "PARTIAL_RELEASE") partial += 1;
    }
    return { released, held, partial, count: decisions.length };
  }, [decisions]);

  return (
    <>
      <Head>
        <title>Escrow decisions — Finance partner — SolNuv</title>
      </Head>
      <div className="max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-1 flex items-center gap-2">
              <RiShieldCheckLine className="text-emerald-600" />
              Escrow decisions
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed max-w-3xl">
              Release, partial-release, and hold decisions recorded by the V2 oracle for your financier
              organizations. Each decision is policy-evaluated, chain-attested, and linked to its custody
              evidence. Financials in this view are indicative until reconciled with your books.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-ghost inline-flex items-center gap-2 self-start"
            disabled={loading}
          >
            <RiRefreshLine className={loading ? "animate-spin" : undefined} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Approved release</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatNgn(totals.released)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Approved hold</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatNgn(totals.held)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Decisions shown</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              {totals.count}
              <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                {totals.partial > 0 ? `(${totals.partial} partial)` : ""}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === f.id
                  ? "bg-forest-900 text-white border-forest-900 dark:bg-emerald-500 dark:border-emerald-500"
                  : "bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading decisions...</div>
          ) : decisions.length === 0 ? (
            <div className="p-10 text-center">
              <RiShieldCheckLine className="mx-auto text-slate-300 dark:text-slate-600" size={36} />
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">No escrow decisions yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Decisions appear here as your financier organizations evaluate release conditions through the
                V2 oracle. Work with your ops team to onboard projects and submit evidence.
              </p>
              <Link
                href="/partners/finance/financials"
                className="mt-4 inline-block text-xs font-semibold text-forest-800 dark:text-emerald-400 underline"
              >
                View aggregate financials →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {decisions.map((d) => {
                const badge = statusBadge(d.decision_type);
                const failed = Array.isArray(d.failed_conditions) ? d.failed_conditions : [];
                return (
                  <li key={d.id} className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${badge.className}`}
                          >
                            <badge.Icon size={12} />
                            {badge.label}
                          </span>
                          {d.policy_version && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              policy {d.policy_version}
                            </span>
                          )}
                          {d.tx_hash && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px]">
                              {d.tx_hash.slice(0, 10)}…{d.tx_hash.slice(-6)}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          Project <span className="font-mono text-xs">{d.project_id}</span>
                        </p>
                        {d.rationale && (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {d.rationale}
                          </p>
                        )}
                        {failed.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {failed.map((c) => (
                              <span
                                key={c}
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="sm:text-right flex sm:flex-col gap-4 sm:gap-1 text-xs">
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Release</p>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                            {formatNgn(d.approved_release_amount_ngn)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Hold</p>
                          <p className="font-semibold text-slate-700 dark:text-slate-200">
                            {formatNgn(d.approved_hold_amount_ngn)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Decided</p>
                          <p className="text-slate-700 dark:text-slate-300">{formatDate(d.decided_at || d.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Need to trigger or override a decision? Contact platform operations — decisions are recorded by the
          V2 oracle and anchored on-chain, so changes require a new attested policy evaluation.
        </p>
      </div>
    </>
  );
}

PartnerFinanceEscrowPage.getLayout = getPartnerFinancierLayout;
