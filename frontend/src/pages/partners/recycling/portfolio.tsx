import Head from "next/head";
import Link from "next/link";
import PartnerLayout from "../../../components/PartnerLayout";
import PartnerProtectedRoute from "../../../components/PartnerProtectedRoute";
import { useAuth } from "../../../context/AuthContext";

export default function PartnerRecyclingPortfolioPage() {
  const { profile } = useAuth();
  const slug = profile?.public_slug ? String(profile.public_slug) : "";

  return (
    <PartnerProtectedRoute allowed={["recycler"]}>
      <PartnerLayout variant="recycler">
        <Head>
          <title>Portfolio — Recycling partner — SolNuv</title>
        </Head>
        <h1 className="text-2xl font-bold text-forest-900 mb-2">Public portfolio</h1>
        <p className="text-slate-600 text-sm mb-6">
          Link to your SolNuv public profile when you publish impact or company narrative. Enable visibility in main app settings
          if needed.
        </p>
        {slug ? (
          <Link href={`/profile/${slug}`} className="text-forest-900 font-semibold underline">
            Open public profile → /profile/{slug}
          </Link>
        ) : (
          <p className="text-sm text-slate-500">
            No public slug on your user profile yet. Complete profile settings in the main app to claim a public URL.
          </p>
        )}
      </PartnerLayout>
    </PartnerProtectedRoute>
  );
}
