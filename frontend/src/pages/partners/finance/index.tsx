import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPartnerFinancierLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";
import { RiHandCoinLine, RiLineChartLine, RiMailLine } from "react-icons/ri";

type Fin = {
  escrow_released_ngn?: number;
  escrow_held_ngn?: number;
  release_decision_count?: number;
};

export default function PartnerFinanceDashboard() {
  const [fin, setFin] = useState<Fin | null>(null);
  const [fundingN, setFundingN] = useState<number | null>(null);

  useEffect(() => {
    void partnerAPI
      .logPortalEvent({ event_type: "financier_dashboard_view", payload: { source: "web" } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void Promise.all([partnerAPI.financierFinancials(), partnerAPI.listFinancierFunding()])
      .then(([f, r]) => {
        setFin(f.data?.data ?? null);
        const n = (r.data?.data?.requests as unknown[])?.length;
        setFundingN(typeof n === "number" ? n : 0);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <Head>
        <title>Finance partner — SolNuv</title>
      </Head>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Financier dashboard</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
          Read-only summaries from release decisions plus your funding pipeline. This portal keeps capital partners oriented without exposing solar
          customer workspaces or editable engineering artifacts.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <RiHandCoinLine className="text-lg" />
              Pipeline
            </p>
            <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed">
              Use{" "}
              <Link href="/partners/finance/funding" className="font-semibold text-forest-800 dark:text-emerald-400 underline">
                Funding requests
              </Link>{" "}
              to register interest and attach diligence links. Status transitions are applied by operations—treat this view as your system of
              engagement, not your ledger.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <RiLineChartLine className="text-lg" />
              Financial posture
            </p>
            <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed">
              <Link href="/partners/finance/financials" className="font-semibold text-forest-800 dark:text-emerald-400 underline">
                Financials
              </Link>{" "}
              aggregates release decisions for your organizations. Figures stay directional until your finance team reconciles with source contracts.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Funding requests</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{fundingN ?? "—"}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Release decisions (rows)</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{fin?.release_decision_count ?? "—"}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Approved release (₦)</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{fin?.escrow_released_ngn ?? "—"}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Approved hold (₦)</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{fin?.escrow_held_ngn ?? "—"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/25 p-4 text-sm text-amber-950 dark:text-amber-100 flex flex-wrap items-start gap-3">
          <RiMailLine className="text-xl shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Need a deeper diligence pack?</p>
            <p className="mt-1 text-amber-900/85 dark:text-amber-200/90">
              Route structured asks through{" "}
              <Link href="/contact" className="underline font-semibold">
                Contact
              </Link>{" "}
              so we can align field data, recycling partners, and funding milestones in one thread.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

PartnerFinanceDashboard.getLayout = getPartnerFinancierLayout;
