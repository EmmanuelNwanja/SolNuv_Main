import { ComingSoonFeaturePage } from "../../../components/ComingSoonFeaturePage";
import { getPartnerRecyclerLayout } from "../../../components/Layout";

export default function PartnerRecyclerApiIntegrationPage() {
  return (
    <ComingSoonFeaturePage
      title="API integration"
      metaTitle="API integration — Recycling partner — SolNuv"
      description="Future API access will let approved recycler organizations sync pickup queues, status changes, and audit-friendly event logs into their own logistics or ESG systems."
      bullets={[
        "Scoped credentials limited to recycler-visible pickup and portal events",
        "Idempotent updates for operational systems of record",
        "Documentation and examples maintained alongside the public API program",
      ]}
      contextHint="Shown inside your recycling partner portal."
    />
  );
}

PartnerRecyclerApiIntegrationPage.getLayout = getPartnerRecyclerLayout;
