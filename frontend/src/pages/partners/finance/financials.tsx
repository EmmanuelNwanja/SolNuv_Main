import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPartnerFinancierLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";

type Fin = {
  escrow_released_ngn?: number;
  escrow_held_ngn?: number;
  release_decision_count?: number;
  co2_fund_placeholder_ngn?: number | null;
};

export default function PartnerFinanceFinancialsPage() {
  const [fin, setFin] = useState<Fin | null>(null);

  useEffect(() => {
    void partnerAPI
      .financierFinancials()
      .then((r) => setFin(r.data?.data ?? null))
      .catch(() => setFin(null));
  }, []);

  return (
    <>
      <Head>
        <title>Financials — Finance partner — SolNuv</title>
      </Head>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Financials</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 leading-relaxed">
          Aggregates from <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">v2_release_decisions</code> for your financier organizations. Treat every figure as indicative until it is reconciled with your internal books and executed agreements.
        </p>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4 text-sm text-slate-700 dark:text-slate-200 mb-6">
          <p className="font-semibold text-slate-900 dark:text-white">How teams use this page</p>
          <ul className="mt-2 list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
            <li>Credit: compare approved release vs. hold balances when reviewing cohort risk.</li>
            <li>Asset management: cross-check counts against your pipeline spreadsheet.</li>
            <li>Ops: jump to individual stories via linked funding requests when IDs are shared.</li>
          </ul>
          <p className="mt-3">
            <Link href="/partners/finance/funding" className="font-semibold text-forest-800 dark:text-emerald-400 underline">
              Open funding requests →
            </Link>
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-3 text-sm">
          <p>
            <span className="text-slate-500 dark:text-slate-400">Approved release (NGN):</span>{" "}
            <span className="font-semibold text-slate-900 dark:text-white">{fin?.escrow_released_ngn ?? "—"}</span>
          </p>
          <p>
            <span className="text-slate-500 dark:text-slate-400">Approved hold (NGN):</span>{" "}
            <span className="font-semibold text-slate-900 dark:text-white">{fin?.escrow_held_ngn ?? "—"}</span>
          </p>
          <p>
            <span className="text-slate-500 dark:text-slate-400">Decision rows:</span>{" "}
            <span className="font-semibold text-slate-900 dark:text-white">{fin?.release_decision_count ?? "—"}</span>
          </p>
        </div>
      </div>
    </>
  );
}

PartnerFinanceFinancialsPage.getLayout = getPartnerFinancierLayout;
