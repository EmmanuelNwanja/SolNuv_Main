import Head from "next/head";
import { useState } from "react";
import toast from "react-hot-toast";
import { getPartnerTrainingLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";

export default function TrainingGraduatesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ total_rows?: number; processed_rows?: number } | null>(null);

  async function submitUpload() {
    if (!file) {
      toast.error("Choose a CSV or Excel file first");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await partnerAPI.importTrainingGraduates(form);
      setLastResult(response.data?.data || null);
      toast.success("Graduate import completed");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Import failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Training graduates import — SolNuv</title>
      </Head>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Graduate import</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Upload CSV/Excel exports with first name, last name, and email fields. SolNuv runs hybrid confidence matching and creates review requests automatically.
        </p>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-5 space-y-4">
          <div>
            <label className="label">Graduate sheet (.csv or .xlsx)</label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="input w-full"
            />
          </div>
          <button type="button" className="btn-primary" onClick={() => void submitUpload()} disabled={submitting}>
            {submitting ? "Uploading..." : "Upload and process"}
          </button>
        </div>

        {lastResult && (
          <div className="mt-5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 text-sm">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">Last import summary</p>
            <p className="mt-1 text-emerald-800 dark:text-emerald-300">
              Total rows: {lastResult.total_rows ?? 0} | Processed rows: {lastResult.processed_rows ?? 0}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

TrainingGraduatesPage.getLayout = getPartnerTrainingLayout;
