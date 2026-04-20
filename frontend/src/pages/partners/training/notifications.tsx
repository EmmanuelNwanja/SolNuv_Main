import Head from "next/head";
import Link from "next/link";
import { getPartnerTrainingLayout } from "../../../components/Layout";

export default function TrainingNotificationsPage() {
  return (
    <>
      <Head>
        <title>Training notifications — SolNuv</title>
      </Head>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Notifications</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Training-institute verification notifications are delivered in-platform. For broader updates, see{" "}
          <Link href="/blog" className="underline text-emerald-500">
            Blog
          </Link>
          .
        </p>
      </div>
    </>
  );
}

TrainingNotificationsPage.getLayout = getPartnerTrainingLayout;
