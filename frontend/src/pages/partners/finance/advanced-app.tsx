import { ComingSoonFeaturePage } from "../../../components/ComingSoonFeaturePage";
import { getPartnerFinancierLayout } from "../../../components/Layout";

export default function PartnerFinanceAdvancedAppPage() {
  return (
    <ComingSoonFeaturePage
      title="Advanced App"
      metaTitle="Advanced App — Finance partner — SolNuv"
      description="Financier partners will eventually get pipeline-grade views: cohort performance, release decision history, and structured exports aligned with how institutions underwrite solar portfolios."
      bullets={[
        "Financier-only lenses on funding interest and release outcomes",
        "Workflow cues that mirror your internal credit / asset management stages",
        "Shared roadmap with the main advanced app, without exposing solar customer workspaces",
      ]}
      contextHint="Shown inside your finance partner portal."
    />
  );
}

PartnerFinanceAdvancedAppPage.getLayout = getPartnerFinancierLayout;
