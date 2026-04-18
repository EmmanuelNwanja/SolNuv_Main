import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPartnerFinancierLayout } from "../../../components/Layout";
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
    <>
      <Head>
        <title>Funding requests — Finance partner — SolNuv</title>
      </Head>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Funding requests</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 leading-relaxed">
          Track pipeline states: submitted → under review → approved / declined. Status updates are applied by operations in a later workflow pass—use notes
          and URLs to keep context attached to each project ID.
        </p>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 text-sm mb-8">
          <p className="font-semibold text-slate-900 dark:text-white">Suggested workflow</p>
          <ol className="mt-2 list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
            <li>Paste the SolNuv project UUID supplied by your deal team.</li>
            <li>Attach design or data-room links reviewers expect to see.</li>
            <li>Reference internal ticket IDs in notes so ops can match your CRM.</li>
          </ol>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Need help locating IDs?{" "}
            <Link href="/faq" className="font-semibold text-forest-800 dark:text-emerald-400 underline">
              FAQ
            </Link>{" "}
            or{" "}
            <Link href="/contact" className="font-semibold text-forest-800 dark:text-emerald-400 underline">
              Contact
            </Link>
            .
          </p>
        </div>

        <form onSubmit={onCreate} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 mb-10 max-w-xl">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">New request</h2>
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
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Your requests</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">None yet.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={String(r.id)} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">{r.project?.name || r.project_id || "Project"}</p>
                    <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                      {STATUS_LABEL[r.status || ""] || r.status || "—"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {r.project?.city}, {r.project?.state}
                  </p>
                  {r.design_share_url && (
                    <p className="mt-2 text-forest-800 dark:text-emerald-400">
                      <a href={r.design_share_url} className="underline" target="_blank" rel="noreferrer">
                        Design link
                      </a>
                    </p>
                  )}
                  {r.notes && <p className="mt-2 text-slate-600 dark:text-slate-300">{r.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

PartnerFinanceFundingPage.getLayout = getPartnerFinancierLayout;
