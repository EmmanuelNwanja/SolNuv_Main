import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import PartnerLayout from "../../../components/PartnerLayout";
import PartnerProtectedRoute from "../../../components/PartnerProtectedRoute";
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
    <PartnerProtectedRoute allowed={["recycler"]}>
      <PartnerLayout variant="recycler">
        <Head>
          <title>ESG — Recycling partner — SolNuv</title>
        </Head>
        <h1 className="text-2xl font-bold text-forest-900 mb-2">ESG & recovery</h1>
        <p className="text-slate-600 text-sm mb-6">
          Aggregate counts from your scoped pickups. Detailed mass / CO₂e methodology can be attached to diligence packs when
          available.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase">Scoped pickups</p>
            <p className="text-2xl font-bold text-forest-900 mt-1">{pickups.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase">With completion timestamp</p>
            <p className="text-2xl font-bold text-forest-900 mt-1">{completed.length}</p>
          </div>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => downloadCsv(pickups)}>
          Export CSV (pickup list)
        </button>
      </PartnerLayout>
    </PartnerProtectedRoute>
  );
}
