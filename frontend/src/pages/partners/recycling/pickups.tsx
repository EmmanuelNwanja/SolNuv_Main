import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPartnerRecyclerLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";
import { RiArticleLine } from "react-icons/ri";

type PickupRow = {
  id?: string;
  preferred_date?: string | null;
  pickup_address?: string | null;
  assigned_recycler?: string | null;
  project?: { name?: string; city?: string; state?: string };
};

export default function PartnerRecyclingPickupsPage() {
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void partnerAPI
      .listRecyclerPickups()
      .then((r) => {
        setPickups((r.data?.data?.pickups as PickupRow[]) || []);
      })
      .catch(() => setPickups([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head>
        <title>Pickups — Recycling partner — SolNuv</title>
      </Head>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Pickup requests</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 leading-relaxed">
          Rows approved for decommission that match your organization assignment or name. This list is a read-only mirror of operations data.
        </p>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4 text-sm text-slate-700 dark:text-slate-200 mb-6">
          <p className="font-semibold text-slate-900 dark:text-white">Field checklist</p>
          <ul className="mt-2 list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
            <li>Confirm address and access constraints before dispatch.</li>
            <li>Log completions so ESG exports and SLA metrics stay accurate.</li>
            <li>
              Questions on scope? Use{" "}
              <Link href="/contact" className="font-medium text-forest-800 dark:text-emerald-400 underline">
                Contact
              </Link>{" "}
              or review{" "}
              <Link href="/faq" className="font-medium text-forest-800 dark:text-emerald-400 underline">
                FAQ
              </Link>
              .
            </li>
          </ul>
        </div>
        {loading ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading…</p>
        ) : pickups.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">No matching pickups yet.</p>
        ) : (
          <div className="space-y-3">
            {pickups.map((p) => (
              <div key={String(p.id)} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm">
                <p className="font-semibold text-slate-900 dark:text-white">{p.project?.name || "Project"}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  {p.project?.city}, {p.project?.state}
                </p>
                <div className="mt-3 grid gap-1 text-slate-600 dark:text-slate-300">
                  {p.pickup_address && (
                    <p>
                      <span className="text-slate-400">Address:</span> {p.pickup_address}
                    </p>
                  )}
                  {p.preferred_date && (
                    <p>
                      <span className="text-slate-400">Preferred:</span> {new Date(p.preferred_date).toLocaleDateString()}
                    </p>
                  )}
                  {p.assigned_recycler && (
                    <p>
                      <span className="text-slate-400">Assigned recycler:</span> {p.assigned_recycler}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-8 text-sm">
          <Link href="/blog" className="inline-flex items-center gap-1.5 font-medium text-forest-800 dark:text-emerald-400 hover:underline">
            <RiArticleLine />
            Related platform guidance
          </Link>
        </p>
      </div>
    </>
  );
}

PartnerRecyclingPickupsPage.getLayout = getPartnerRecyclerLayout;
