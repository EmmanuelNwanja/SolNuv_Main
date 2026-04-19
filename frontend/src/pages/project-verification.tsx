import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { RiSearchLine, RiShieldCheckLine, RiToolsLine, RiMapPinLine, RiArrowRightLine } from "react-icons/ri";
import { getPublicLayout } from "../components/Layout";
import { MotionSection } from "../components/PageMotion";
import { projectsAPI } from "../services/api";

type PublicProjectSearchResult = {
  project_id: string;
  project_name: string;
  client_name?: string | null;
  location?: string | null;
  tracked_on_solnuv: boolean;
  tracking_status: string;
  verification_status: string;
  manufacturers: { panel: string[]; battery: string[]; inverter: string[] };
  installer: {
    name: string;
    is_professionally_verified: boolean;
    verification_status: string;
    public_slug?: string | null;
  };
  company_public_data?: {
    name?: string | null;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
    registration_number?: string | null;
  } | null;
  verify_url?: string | null;
};

export default function ProjectVerificationPortalPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PublicProjectSearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const summary = useMemo(() => {
    const tracked = results.filter((r) => r.tracked_on_solnuv).length;
    const verifiedInstallers = results.filter((r) => r.installer?.is_professionally_verified).length;
    return { tracked, verifiedInstallers, total: results.length };
  }, [results]);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 3) {
      toast.error("Enter at least 3 characters");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await projectsAPI.searchPublic({ q, limit: 20 });
      setResults((data?.data?.results || []) as PublicProjectSearchResult[]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Project Verification Portal | SolNuv</title>
        <meta
          name="description"
          content="Search and verify tracked solar projects, equipment brands, and installer/company public verification details."
        />
      </Head>

      <MotionSection className="marketing-section marketing-section-animated">
        <span className="marketing-kicker">Verification</span>
        <h1 className="marketing-headline mt-3">Public project verification portal</h1>
        <p className="marketing-subcopy">
          Search for your project to confirm it is tracked on SolNuv for maintenance and ESG compliance, inspect listed equipment brands, and verify the executing engineer/company profile.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <input
            className="input flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by project name, client name, or verification code"
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
          />
          <button
            type="button"
            className="btn-primary px-5 py-2 inline-flex items-center justify-center gap-2"
            onClick={() => void runSearch()}
            disabled={loading}
          >
            <RiSearchLine /> {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Need QR verification directly? Use the link on your project QR tag.
        </div>
      </MotionSection>

      <MotionSection className="marketing-section marketing-section-animated">
        {searched && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Projects found</p>
              <p className="text-xl font-semibold text-slate-900">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Added for tracking</p>
              <p className="text-xl font-semibold text-emerald-700">{summary.tracked}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">Verified professionals</p>
              <p className="text-xl font-semibold text-blue-700">{summary.verifiedInstallers}</p>
            </div>
          </div>
        )}

        {searched && results.length === 0 && !loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No tracked projects matched this search.
          </div>
        )}

        <div className="space-y-4">
          {results.map((item) => (
            <div key={item.project_id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{item.project_name}</h2>
                  <p className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1">
                    <RiMapPinLine /> {item.location || "Location unavailable"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs rounded-full px-2.5 py-1 border border-emerald-200 bg-emerald-50 text-emerald-800">
                    {item.tracked_on_solnuv ? "Tracked on SolNuv" : "Not tracked"}
                  </span>
                  <span className="text-xs rounded-full px-2.5 py-1 border border-slate-200 bg-slate-50 text-slate-700 capitalize">
                    {item.tracking_status}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500 text-xs uppercase tracking-wide">Equipment & brands</p>
                  <p className="mt-2 text-slate-700">
                    <span className="font-semibold">Panels:</span> {(item.manufacturers?.panel || []).join(", ") || "N/A"}
                  </p>
                  <p className="text-slate-700">
                    <span className="font-semibold">Batteries:</span> {(item.manufacturers?.battery || []).join(", ") || "N/A"}
                  </p>
                  <p className="text-slate-700">
                    <span className="font-semibold">Inverters:</span> {(item.manufacturers?.inverter || []).join(", ") || "N/A"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-slate-500 text-xs uppercase tracking-wide">Executing company / engineer</p>
                  <p className="mt-2 text-slate-900 font-semibold">{item.installer?.name || "Unknown installer"}</p>
                  <p className="text-slate-700 inline-flex items-center gap-1 mt-1">
                    <RiShieldCheckLine className={item.installer?.is_professionally_verified ? "text-emerald-600" : "text-amber-600"} />
                    {item.installer?.is_professionally_verified ? "Professionally verified" : "Verification pending"}
                  </p>
                  {item.company_public_data?.registration_number && (
                    <p className="text-slate-700 mt-1">
                      Reg. no: <span className="font-medium">{item.company_public_data.registration_number}</span>
                    </p>
                  )}
                  {item.company_public_data?.website && (
                    <p className="text-slate-700 mt-1 break-all">{item.company_public_data.website}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {item.verify_url ? (
                  <Link href={item.verify_url} className="btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5">
                    <RiToolsLine /> View full verification <RiArrowRightLine />
                  </Link>
                ) : (
                  <span className="text-xs text-slate-500">No QR verification link available</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </MotionSection>
    </>
  );
}

ProjectVerificationPortalPage.getLayout = getPublicLayout;
