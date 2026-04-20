import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPartnerTrainingLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";

type VerificationRequest = {
  id: string;
  status: string;
  match_confidence?: number;
};

export default function PartnerTrainingDashboard() {
  const [requestCount, setRequestCount] = useState<number | null>(null);
  const [highConfidenceCount, setHighConfidenceCount] = useState<number | null>(null);

  useEffect(() => {
    void partnerAPI
      .listTrainingVerificationRequests()
      .then((response) => {
        const rows = (response.data?.data?.requests || []) as VerificationRequest[];
        setRequestCount(rows.length);
        setHighConfidenceCount(rows.filter((row) => Number(row.match_confidence || 0) >= 0.9).length);
      })
      .catch(() => {
        setRequestCount(0);
        setHighConfidenceCount(0);
      });
  }, []);

  return (
    <>
      <Head>
        <title>Training institute partner — SolNuv</title>
      </Head>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Training institute dashboard</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
          Manage graduate imports, confidence-based matching, and professional competency verification decisions.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Verification requests</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{requestCount ?? "—"}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">High confidence matches</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{highConfidenceCount ?? "—"}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Import mode</p>
            <p className="text-lg font-bold text-forest-900 dark:text-white mt-1">CSV / Excel</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Status</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-1">Active</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/partners/training/graduates" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 hover:border-emerald-400 transition-colors">
            <p className="font-semibold text-slate-900 dark:text-white">Trained professionals</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Upload graduate datasets and inspect row-level outcomes.</p>
          </Link>
          <Link href="/partners/training/requests" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 hover:border-emerald-400 transition-colors">
            <p className="font-semibold text-slate-900 dark:text-white">Verification queue</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Approve/reject matched requests and leave audit-grade reasons.</p>
          </Link>
          <Link href="/partners/training/impact" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 hover:border-emerald-400 transition-colors">
            <p className="font-semibold text-slate-900 dark:text-white">Impact</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Track verification decisions and ecosystem outcomes over time.</p>
          </Link>
        </div>
      </div>
    </>
  );
}

PartnerTrainingDashboard.getLayout = getPartnerTrainingLayout;
