import Head from "next/head";
import { getPartnerTrainingLayout } from "../../../components/Layout";

export default function TrainingSettingsPage() {
  return (
    <>
      <Head>
        <title>Training settings — SolNuv</title>
      </Head>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Training portal settings</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Organization-level controls for training institutes are managed by SolNuv operations for this release.
        </p>
      </div>
    </>
  );
}

TrainingSettingsPage.getLayout = getPartnerTrainingLayout;
