import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../../context/AuthContext";
import { authAPI, v2API } from "../../../services/api";
import { hasPartnerRecycler } from "../../../utils/partnerPortal";
import toast from "react-hot-toast";

export default function PartnerRecyclingSignupPage() {
  const { session, profile, profileResolved, refreshProfile } = useAuth();
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profileResolved) return;
    if (session && hasPartnerRecycler(profile)) {
      void router.replace("/partners/recycling");
    }
  }, [profileResolved, session, profile, router]);

  useEffect(() => {
    if (profile?.first_name) setFirstName(String(profile.first_name));
    if (profile?.last_name) setLastName(String(profile.last_name || ""));
    if (profile?.phone) setPhone(String(profile.phone || ""));
  }, [profile]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) {
      toast.error("Sign in to continue");
      const next = encodeURIComponent("/partners/recycling/signup");
      void router.push(`/login?next=${next}`);
      return;
    }
    if (!orgName.trim() || !firstName.trim() || !phone.trim()) {
      toast.error("Organization name, first name, and phone are required");
      return;
    }
    setBusy(true);
    try {
      await authAPI.saveProfile({
        first_name: firstName.trim(),
        last_name: (lastName.trim() || " ").slice(0, 120),
        phone: phone.trim(),
        user_type: "installer",
        business_type: "solo",
        brand_name: orgName.trim(),
      });
      await v2API.registerActor({
        organization_name: orgName.trim(),
        actor_type: "recycler",
        role_title: "member",
        jurisdiction: "NG",
      });
      await refreshProfile();
      toast.success("Recycler organization linked to your account");
      void router.replace("/partners/recycling");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      toast.error(ax.response?.data?.message || "Could not complete partner signup");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Recycling partner signup — SolNuv</title>
      </Head>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-forest-900">Recycling partner</h1>
            <p className="text-sm text-slate-500 mt-1">
              Create your recycler organization and access assigned pickups and ESG summaries.
            </p>
          </div>
          {!session ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Sign in or create an account to register as a partner.</p>
              <Link
                href={`/login?next=${encodeURIComponent("/partners/recycling/signup")}`}
                className="btn-primary w-full inline-block text-center"
              >
                Sign in
              </Link>
              <Link href="/register" className="btn-ghost w-full inline-block text-center text-sm">
                Create account
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">Organization name</label>
                <input
                  className="input w-full"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. GreenCycle Nigeria Ltd"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First name</label>
                  <input className="input w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Last name</label>
                  <input className="input w-full" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input w-full" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? "Saving…" : "Register recycler organization"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
