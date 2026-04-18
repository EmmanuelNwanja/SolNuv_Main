import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPartnerRecyclerLayout } from "../../../components/Layout";
import { partnerAPI } from "../../../services/api";
import { RiArticleLine, RiRecycleLine, RiTimeLine } from "react-icons/ri";

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
    <>
      <Head>
        <title>Recycling partner — SolNuv</title>
      </Head>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Recycler dashboard</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
          Operational mirror for your organization: pickup workload, SLA-style timing, and audit-friendly portal events. Data is scoped to recycler
          assignments—this is not the solar customer workspace.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/25 p-4 text-sm text-emerald-950 dark:text-emerald-100">
            <p className="font-semibold flex items-center gap-2">
              <RiRecycleLine className="text-lg" />
              Daily operations
            </p>
            <p className="mt-2 text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed">
              Start in{" "}
              <Link href="/partners/recycling/pickups" className="font-semibold underline underline-offset-2">
                Pickups
              </Link>{" "}
              for the live queue. Use{" "}
              <Link href="/partners/recycling/esg" className="font-semibold underline underline-offset-2">
                ESG &amp; impact
              </Link>{" "}
              for recovery and reporting context, and{" "}
              <Link href="/partners/recycling/portfolio" className="font-semibold underline underline-offset-2">
                Portfolio
              </Link>{" "}
              for how projects surface to your team.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-4 text-sm text-slate-700 dark:text-slate-200">
            <p className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <RiTimeLine className="text-lg" />
              SLA &amp; trust
            </p>
            <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
              Averages below are computed from portal-visible completions. They help your ops lead spot drift before customers do—not a contractual
              SLA unless your agreement says otherwise.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Assigned pickups</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{pickupCount ?? "—"}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Completed (scoped)</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">{sla?.completed_count ?? "—"}</p>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Avg. days (request → complete)</p>
            <p className="text-2xl font-bold text-forest-900 dark:text-white mt-1">
              {sla?.avg_days_request_to_complete != null ? sla.avg_days_request_to_complete : "—"}
            </p>
          </div>
        </div>

        <section className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Recent portal events</h2>
          {events.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No events logged yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {events.map((ev) => (
                <li key={ev.id || `${ev.event_type}-${ev.created_at}`} className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{ev.event_type || "event"}</span>
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80"
          >
            <RiArticleLine />
            Field notes &amp; updates
          </Link>
          <Link href="/faq" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80">
            Partner FAQ
          </Link>
        </div>
      </div>
    </>
  );
}

PartnerRecyclingDashboard.getLayout = getPartnerRecyclerLayout;
