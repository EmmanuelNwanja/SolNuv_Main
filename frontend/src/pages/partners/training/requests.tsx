import Head from "next/head";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getPartnerTrainingLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";

type RequestRow = {
  id: string;
  status: string;
  match_confidence?: number;
  target_user?: { first_name?: string; last_name?: string; email?: string } | null;
  graduate?: { first_name?: string; last_name?: string; email?: string } | null;
};

export default function TrainingRequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadRows() {
    setLoading(true);
    try {
      const response = await partnerAPI.listTrainingVerificationRequests();
      setRows((response.data?.data?.requests || []) as RequestRow[]);
    } catch {
      toast.error("Could not load verification requests");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    try {
      await partnerAPI.decideTrainingVerificationRequest(id, { decision });
      toast.success(`Request ${decision}d`);
      await loadRows();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Decision failed");
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  return (
    <>
      <Head>
        <title>Training verification queue — SolNuv</title>
      </Head>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Competency verification queue</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Review hybrid-confidence matches and manual requests. Approvals apply the professional competency badge.
        </p>

        <div className="space-y-3">
          {loading && <p className="text-sm text-slate-500">Loading queue...</p>}
          {!loading && rows.length === 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 text-sm text-slate-500">
              No verification requests available.
            </div>
          )}
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {(row.target_user?.first_name || row.graduate?.first_name || "Unknown")}{" "}
                    {(row.target_user?.last_name || row.graduate?.last_name || "").trim()}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {row.target_user?.email || row.graduate?.email || "No email"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Confidence: {Math.round(Number(row.match_confidence || 0) * 100)}%
                  </p>
                </div>
                <span className="text-xs rounded-full px-2.5 py-1 border border-slate-200 bg-slate-50 text-slate-700 capitalize">
                  {row.status}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn-primary text-xs px-3 py-1.5"
                  onClick={() => void decide(row.id, "approve")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => void decide(row.id, "reject")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

TrainingRequestsPage.getLayout = getPartnerTrainingLayout;
