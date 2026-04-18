import { ComingSoonFeaturePage } from "../../../components/ComingSoonFeaturePage";
import { getPartnerFinancierLayout } from "../../../components/Layout";

export default function PartnerFinanceApiIntegrationPage() {
  return (
    <ComingSoonFeaturePage
      title="API integration"
      metaTitle="API integration — Finance partner — SolNuv"
      description="Approved finance partners will be able to pull structured funding signals and release metadata into internal risk systems, subject to contract and data minimization rules."
      bullets={[
        "Read-only financier scopes with explicit field allow-lists",
        "Event streams for funding interest and decision milestones",
        "Joint security review before production credentials are issued",
      ]}
      contextHint="Shown inside your finance partner portal."
    />
  );
}

PartnerFinanceApiIntegrationPage.getLayout = getPartnerFinancierLayout;
