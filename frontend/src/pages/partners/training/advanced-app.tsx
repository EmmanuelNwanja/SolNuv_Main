import Head from "next/head";
import { getPartnerTrainingLayout } from "../../../components/Layout";

export default function TrainingAdvancedAppPage() {
  return (
    <>
      <Head>
        <title>Training advanced app — SolNuv</title>
      </Head>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Advanced App (Coming Soon)</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Workflow automation for training intake and external registry sync is coming soon.
        </p>
      </div>
    </>
  );
}

TrainingAdvancedAppPage.getLayout = getPartnerTrainingLayout;
