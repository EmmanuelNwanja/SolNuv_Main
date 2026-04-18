import Head from "next/head";
import { useEffect, useState } from "react";
import Link from "next/link";
import PartnerLayout from "../../../components/PartnerLayout";
import PartnerProtectedRoute from "../../../components/PartnerProtectedRoute";
import { partnerAPI } from "../../../services/api";

type Fin = {
  escrow_released_ngn?: number;
  escrow_held_ngn?: number;
  release_decision_count?: number;
};

export default function PartnerFinanceDashboard() {
  const [fin, setFin] = useState<Fin | null>(null);
  const [fundingN, setFundingN] = useState<number | null>(null);

  useEffect(() => {
    void partnerAPI
      .logPortalEvent({ event_type: "financier_dashboard_view", payload: { source: "web" } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void Promise.all([partnerAPI.financierFinancials(), partnerAPI.listFinancierFunding()])
      .then(([f, r]) => {
        setFin(f.data?.data ?? null);
        const n = (r.data?.data?.requests as unknown[])?.length;
        setFundingN(typeof n === "number" ? n : 0);
      })
      .catch(() => {});
  }, []);

  return (
    <PartnerProtectedRoute allowed={["financier"]}>
      <PartnerLayout variant="financier">
        <Head>
          <title>Finance partner — SolNuv</title>
        </Head>
        <h1 className="text-2xl font-bold text-forest-900 mb-2">Financier dashboard</h1>
        <p className="text-slate-600 text-sm mb-8">
          Read-only summaries from release decisions. Use{" "}
          <Link href="/partners/finance/funding" className="text-forest-900 font-medium underline">
            Funding requests
          </Link>{" "}
          to log interest in projects.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase">Funding requests</p>
            <p className="text-2xl font-bold text-forest-900 mt-1">{fundingN ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase">Release decisions (rows)</p>
            <p className="text-2xl font-bold text-forest-900 mt-1">{fin?.release_decision_count ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase">Approved release (₦)</p>
            <p className="text-2xl font-bold text-forest-900 mt-1">{fin?.escrow_released_ngn ?? "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase">Approved hold (₦)</p>
            <p className="text-2xl font-bold text-forest-900 mt-1">{fin?.escrow_held_ngn ?? "—"}</p>
          </div>
        </div>
      </PartnerLayout>
    </PartnerProtectedRoute>
  );
}
