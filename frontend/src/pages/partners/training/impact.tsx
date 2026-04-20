import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { getPartnerTrainingLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";

type RequestRow = { status: string; match_confidence?: number };

export default function TrainingImpactPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);

  useEffect(() => {
    void partnerAPI
      .listTrainingVerificationRequests()
      .then((response) => setRows((response.data?.data?.requests || []) as RequestRow[]))
      .catch(() => setRows([]));
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const approved = rows.filter((row) => row.status === "approved").length;
    const rejected = rows.filter((row) => row.status === "rejected").length;
    const pending = rows.filter((row) => row.status === "pending" || row.status === "under_review").length;
    const avgConfidence = total
      ? Math.round(
          (rows.reduce((sum, row) => sum + Number(row.match_confidence || 0), 0) / total) * 100
        )
      : 0;
    return { total, approved, rejected, pending, avgConfidence };
  }, [rows]);

  return (
    <>
      <Head>
        <title>Training impact — SolNuv</title>
      </Head>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Training verification impact</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          This panel tracks how your institute decisions contribute to trusted professional discovery on SolNuv.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
            <p className="text-xs uppercase text-slate-500">Total requests</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/25 p-4">
            <p className="text-xs uppercase text-emerald-700 dark:text-emerald-300">Approved</p>
            <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">{stats.approved}</p>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/25 p-4">
            <p className="text-xs uppercase text-amber-700 dark:text-amber-300">Pending</p>
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-200 mt-1">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/25 p-4">
            <p className="text-xs uppercase text-red-700 dark:text-red-300">Rejected</p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-200 mt-1">{stats.rejected}</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
            <p className="text-xs uppercase text-slate-500">Avg confidence</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.avgConfidence}%</p>
          </div>
        </div>
      </div>
    </>
  );
}

TrainingImpactPage.getLayout = getPartnerTrainingLayout;
