import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getPartnerRecyclerLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";

type PickupRow = {
  id?: string;
  project?: { name?: string; city?: string; state?: string };
  completed_at?: string | null;
  created_at?: string | null;
};

function downloadCsv(rows: PickupRow[]) {
  const header = ["pickup_id", "project", "city", "state", "created_at", "completed_at"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.id || "",
        JSON.stringify(r.project?.name || ""),
        JSON.stringify(r.project?.city || ""),
        JSON.stringify(r.project?.state || ""),
        r.created_at || "",
        r.completed_at || "",
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `partner-esg-pickups-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PartnerRecyclingEsgPage() {
  const [pickups, setPickups] = useState<PickupRow[]>([]);

  const load = useCallback(() => {
    void partnerAPI
      .listRecyclerPickups()
      .then((r) => setPickups((r.data?.data?.pickups as PickupRow[]) || []))
      .catch(() => setPickups([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completed = pickups.filter((p) => p.completed_at);

  return (
    <>
      <Head>
        <title>ESG — Recycling partner — SolNuv</title>
      </Head>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">ESG &amp; recovery</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 leading-relaxed">
          Aggregate counts from your scoped pickups. Pair this export with your internal mass-balance or CO₂e models—SolNuv stores operational truth; your sustainability team owns methodology.
        </p>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 text-sm text-emerald-950 dark:text-emerald-100 mb-6">
          <p className="font-semibold">Reporting tip</p>
          <p className="mt-1 text-emerald-900/85 dark:text-emerald-200/90">
            For auditors, keep the CSV alongside ticket photos or weighbridge receipts stored in your QMS. Need a different column layout? Note it in{" "}
            <Link href="/contact" className="underline font-medium">
              Contact
            </Link>{" "}
            so we can prioritize partner exports.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Scoped pickups</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{pickups.length}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">With completion timestamp</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{completed.length}</p>
          </div>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => downloadCsv(pickups)}>
          Export CSV (pickup list)
        </button>
      </div>
    </>
  );
}

PartnerRecyclingEsgPage.getLayout = getPartnerRecyclerLayout;
