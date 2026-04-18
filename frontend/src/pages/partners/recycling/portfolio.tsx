import Head from "next/head";
import Link from "next/link";
import { getPartnerRecyclerLayout } from "../../../components/Layout";
import { useAuth } from "../../../context/AuthContext";

export default function PartnerRecyclingPortfolioPage() {
  const { profile } = useAuth();
  const slug = profile?.public_slug ? String(profile.public_slug) : "";

  return (
    <>
      <Head>
        <title>Portfolio — Recycling partner — SolNuv</title>
      </Head>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-forest-900 dark:text-white mb-2">Public portfolio</h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
          Link to your SolNuv public profile when you publish impact or company narrative. Visibility flags still live in{" "}
          <Link href="/partners/recycling/settings" className="font-semibold text-forest-800 dark:text-emerald-400 underline">
            Settings
          </Link>{" "}
          so you can tune what appears without leaving the partner shell.
        </p>
        {slug ? (
          <Link href={`/profile/${slug}`} className="text-forest-800 dark:text-emerald-400 font-semibold underline">
            Open public profile → /profile/{slug}
          </Link>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No public slug on your user profile yet. Open{" "}
            <Link href="/partners/recycling/settings" className="font-medium text-forest-800 dark:text-emerald-400 underline">
              Settings
            </Link>{" "}
            to complete your profile and claim a public URL.
          </p>
        )}
      </div>
    </>
  );
}

PartnerRecyclingPortfolioPage.getLayout = getPartnerRecyclerLayout;
