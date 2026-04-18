import { ComingSoonFeaturePage } from "../components/ComingSoonFeaturePage";
import { getDashboardLayout } from "../components/Layout";

export default function AdvancedAppPage() {
  return (
    <ComingSoonFeaturePage
      title="Advanced App"
      metaTitle="Advanced App — SolNuv"
      description="A deeper operations workspace for teams that run solar portfolios at scale: richer analytics, batch workflows, and tighter handoffs between engineering, field, and finance."
      bullets={[
        "Portfolio-wide views with drill-down to project milestones and compliance artifacts",
        "Saved views, operational checklists, and team-ready summaries you can share internally",
        "Tighter alignment with partner programs (recycling, finance) as those workflows mature on the platform",
      ]}
    />
  );
}

AdvancedAppPage.getLayout = getDashboardLayout;
