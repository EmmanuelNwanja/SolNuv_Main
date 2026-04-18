import Head from "next/head";
import { useEffect, useState } from "react";
import PartnerLayout from "../../../components/PartnerLayout";
import PartnerProtectedRoute from "../../../components/PartnerProtectedRoute";
import { partnerAPI } from "../../../services/api";

type Fin = {
  escrow_released_ngn?: number;
  escrow_held_ngn?: number;
  release_decision_count?: number;
  co2_fund_placeholder_ngn?: number | null;
};

export default function PartnerFinanceFinancialsPage() {
  const [fin, setFin] = useState<Fin | null>(null);

  useEffect(() => {
    void partnerAPI
      .financierFinancials()
      .then((r) => setFin(r.data?.data ?? null))
      .catch(() => setFin(null));
  }, []);

  return (
    <PartnerProtectedRoute allowed={["financier"]}>
      <PartnerLayout variant="financier">
        <Head>
          <title>Financials — Finance partner — SolNuv</title>
        </Head>
        <h1 className="text-2xl font-bold text-forest-900 mb-2">Financials</h1>
        <p className="text-slate-600 text-sm mb-6">
          Aggregates from <code className="text-xs bg-slate-100 px-1 rounded">v2_release_decisions</code> for your financier
          organizations. Figures are informational until finance signs off on business rules.
        </p>
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 text-sm">
          <p>
            <span className="text-slate-500">Approved release (NGN):</span>{" "}
            <span className="font-semibold">{fin?.escrow_released_ngn ?? "—"}</span>
          </p>
          <p>
            <span className="text-slate-500">Approved hold (NGN):</span>{" "}
            <span className="font-semibold">{fin?.escrow_held_ngn ?? "—"}</span>
          </p>
          <p>
            <span className="text-slate-500">Decision rows:</span>{" "}
            <span className="font-semibold">{fin?.release_decision_count ?? "—"}</span>
          </p>
        </div>
      </PartnerLayout>
    </PartnerProtectedRoute>
  );
}
