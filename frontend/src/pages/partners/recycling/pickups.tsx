import Head from "next/head";
import { useEffect, useState } from "react";
import PartnerLayout from "../../../components/PartnerLayout";
import PartnerProtectedRoute from "../../../components/PartnerProtectedRoute";
import { partnerAPI } from "../../../services/api";

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
    <PartnerProtectedRoute allowed={["recycler"]}>
      <PartnerLayout variant="recycler">
        <Head>
          <title>Pickups — Recycling partner — SolNuv</title>
        </Head>
        <h1 className="text-2xl font-bold text-forest-900 mb-2">Pickup requests</h1>
        <p className="text-slate-600 text-sm mb-6">
          Rows approved for decommission that match your organization assignment or name. Read-only mirror of operations data.
        </p>
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : pickups.length === 0 ? (
          <p className="text-slate-500 text-sm">No matching pickups yet.</p>
        ) : (
          <div className="space-y-3">
            {pickups.map((p) => (
              <div key={String(p.id)} className="bg-white border border-slate-200 rounded-xl p-4 text-sm">
                <p className="font-semibold text-slate-900">{p.project?.name || "Project"}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {p.project?.city}, {p.project?.state}
                </p>
                <div className="mt-3 grid gap-1 text-slate-600">
                  {p.pickup_address && (
                    <p>
                      <span className="text-slate-400">Address:</span> {p.pickup_address}
                    </p>
                  )}
                  {p.preferred_date && (
                    <p>
                      <span className="text-slate-400">Preferred:</span>{" "}
                      {new Date(p.preferred_date).toLocaleDateString()}
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
      </PartnerLayout>
    </PartnerProtectedRoute>
  );
}
