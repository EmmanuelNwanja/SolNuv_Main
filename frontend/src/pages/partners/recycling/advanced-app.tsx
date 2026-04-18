import { ComingSoonFeaturePage } from "../../../components/ComingSoonFeaturePage";
import { getPartnerRecyclerLayout } from "../../../components/Layout";

export default function PartnerRecyclerAdvancedAppPage() {
  return (
    <ComingSoonFeaturePage
      title="Advanced App"
      metaTitle="Advanced App — Recycling partner — SolNuv"
      description="When advanced workspace features launch, recycler partners will see assignment-aware views: pickup throughput, SLA trends, and exportable operational summaries without leaving the partner portal."
      bullets={[
        "Recycler-scoped analytics layered on top of the main advanced app experience",
        "Clear separation from solar customer workspaces—no accidental cross-navigation",
        "Optional automation hooks as API integration rolls out to approved partners",
      ]}
      contextHint="Shown inside your recycling partner portal."
    />
  );
}

PartnerRecyclerAdvancedAppPage.getLayout = getPartnerRecyclerLayout;
