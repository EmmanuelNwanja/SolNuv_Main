import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import PartnerLayout from "../../../components/PartnerLayout";
import PartnerProtectedRoute from "../../../components/PartnerProtectedRoute";
import { partnerAPI } from "../../../services/api";

type Sla = {
  completed_count?: number;
  avg_days_request_to_complete?: number | null;
};

type PortalEvent = { id?: string; event_type?: string; created_at?: string; payload?: Record<string, unknown> };

export default function PartnerRecyclingDashboard() {
  const [sla, setSla] = useState<Sla | null>(null);
  const [events, setEvents] = useState<PortalEvent[]>([]);
  const [pickupCount, setPickupCount] = useState<number | null>(null);

  useEffect(() => {
    void partnerAPI
      .logPortalEvent({ event_type: "recycler_dashboard_view", payload: { source: "web" } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void Promise.all([partnerAPI.recyclerSlaSummary(), partnerAPI.listPortalEvents({ limit: 15 }), partnerAPI.listRecyclerPickups()])
      .then(([slaRes, evRes, puRes]) => {
        setSla(slaRes.data?.data ?? null);
        setEvents((evRes.data?.data?.events as PortalEvent[]) || []);
        const n = (puRes.data?.data?.pickups as unknown[])?.length;
        setPickupCount(typeof n === "number" ? n : 0);
      })
      .catch(() => {});
  }, []);

  return (
    <PartnerProtectedRoute allowed={["recycler"]}>
      <PartnerLayout variant="recycler">
        <Head>
          <title>Recycling partner — SolNuv</title>
        </Head>
        <h1 className="text-2xl font-bold text-forest-900 mb-2">Recycler dashboard</h1>
        <p className="text-slate-600 text-sm mb-8">
          SLA metrics and recent portal activity. Assigned pickups are listed under{" "}
          <Link href="/partners/recycling/pickups" className="text-forest-900 font-medium underline">
            Pickups
          </Link>
          .
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Assigned pickups</p>
            <p className="text-2xl font-bold text-forest-900 mt-1">{pickupCount ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Completed (scoped)</p>
            <p className="text-2xl font-bold text-forest-900 mt-1">{sla?.completed_count ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Avg. days (request → complete)</p>
            <p className="text-2xl font-bold text-forest-900 mt-1">
              {sla?.avg_days_request_to_complete != null ? sla.avg_days_request_to_complete : "—"}
            </p>
          </div>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent portal events</h2>
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">No events logged yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {events.map((ev) => (
                <li key={ev.id || `${ev.event_type}-${ev.created_at}`} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                  <span className="font-medium text-slate-800">{ev.event_type || "event"}</span>
                  <span className="text-slate-500 shrink-0">
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PartnerLayout>
    </PartnerProtectedRoute>
  );
}
