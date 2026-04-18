import Head from "next/head";
import { useEffect, useState } from "react";
import PartnerLayout from "../../../components/PartnerLayout";
import PartnerProtectedRoute from "../../../components/PartnerProtectedRoute";
import { partnerAPI } from "../../../services/api";
import toast from "react-hot-toast";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

type FundingReq = {
  id?: string;
  status?: string;
  project_id?: string;
  design_share_url?: string | null;
  portfolio_url?: string | null;
  notes?: string | null;
  project?: { name?: string; city?: string; state?: string };
};

export default function PartnerFinanceFundingPage() {
  const [rows, setRows] = useState<FundingReq[]>([]);
  const [projectId, setProjectId] = useState("");
  const [designUrl, setDesignUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    void partnerAPI
      .listFinancierFunding()
      .then((r) => setRows((r.data?.data?.requests as FundingReq[]) || []))
      .catch(() => setRows([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId.trim()) {
      toast.error("Project ID is required");
      return;
    }
    setBusy(true);
    try {
      await partnerAPI.createFinancierFunding({
        project_id: projectId.trim(),
        design_share_url: designUrl.trim() || undefined,
        portfolio_url: portfolioUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Funding request recorded");
      setProjectId("");
      setDesignUrl("");
      setPortfolioUrl("");
      setNotes("");
      load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message || "Could not create request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PartnerProtectedRoute allowed={["financier"]}>
      <PartnerLayout variant="financier">
        <Head>
          <title>Funding requests — Finance partner — SolNuv</title>
        </Head>
        <h1 className="text-2xl font-bold text-forest-900 mb-2">Funding requests</h1>
        <p className="text-slate-600 text-sm mb-8">
          Track pipeline states: submitted → under review → approved / declined. Status updates are applied by operations in a later
          workflow pass.
        </p>

        <form onSubmit={onCreate} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 mb-10 max-w-xl">
          <h2 className="text-sm font-semibold text-slate-800">New request</h2>
          <div>
            <label className="label">Project ID (UUID)</label>
            <input className="input w-full font-mono text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          </div>
          <div>
            <label className="label">Design share URL (optional)</label>
            <input className="input w-full" value={designUrl} onChange={(e) => setDesignUrl(e.target.value)} />
          </div>
          <div>
            <label className="label">Portfolio URL (optional)</label>
            <input className="input w-full" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input w-full min-h-[72px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button type="submit" disabled={busy} className="btn-primary text-sm">
            {busy ? "Saving…" : "Submit request"}
          </button>
        </form>

        <section>
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Your requests</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">None yet.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={String(r.id)} className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{r.project?.name || r.project_id || "Project"}</p>
                    <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                      {STATUS_LABEL[r.status || ""] || r.status || "—"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {r.project?.city}, {r.project?.state}
                  </p>
                  {r.design_share_url && (
                    <p className="mt-2 text-forest-900">
                      <a href={r.design_share_url} className="underline" target="_blank" rel="noreferrer">
                        Design link
                      </a>
                    </p>
                  )}
                  {r.notes && <p className="mt-2 text-slate-600">{r.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </PartnerLayout>
    </PartnerProtectedRoute>
  );
}
