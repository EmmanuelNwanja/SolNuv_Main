import { ComingSoonFeaturePage } from "../components/ComingSoonFeaturePage";
import { getDashboardLayout } from "../components/Layout";

export default function ApiIntegrationPage() {
  return (
    <ComingSoonFeaturePage
      title="API integration"
      metaTitle="API integration — SolNuv"
      description="Programmatic access to the same objects you see in the dashboard—projects, documents, milestones, and notifications—so you can connect SolNuv to your ERP, data warehouse, or internal tools."
      bullets={[
        "Authenticated REST-style endpoints scoped to your organization",
        "Webhooks for high-signal events (milestones, compliance, funding status)",
        "Sandbox keys, rotation guidance, and usage visibility for platform admins",
      ]}
    />
  );
}

ApiIntegrationPage.getLayout = getDashboardLayout;
