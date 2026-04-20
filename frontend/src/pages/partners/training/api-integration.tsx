import Head from "next/head";
import { getPartnerTrainingLayout } from "../../../components/Layout";

export default function TrainingApiIntegrationPage() {
  return (
    <>
      <Head>
        <title>Training API integration — SolNuv</title>
      </Head>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">API integration</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          API and SIS/LMS integrations for training institutes are in staged rollout.
        </p>
      </div>
    </>
  );
}

TrainingApiIntegrationPage.getLayout = getPartnerTrainingLayout;
