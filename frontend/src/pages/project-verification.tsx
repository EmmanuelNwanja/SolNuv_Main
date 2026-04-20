import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { RiSearchLine, RiShieldCheckLine, RiToolsLine, RiMapPinLine, RiArrowRightLine } from "react-icons/ri";
import { getPublicLayout } from "../components/Layout";
import { MotionSection } from "../components/PageMotion";
import { projectsAPI, verificationAPI } from "../services/api";

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
  const router = useRouter();
  const tab = String(router.query?.tab || "project");
  const isProfessionalTab = tab === "professional";
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PublicProjectSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [professionalMode, setProfessionalMode] = useState<"professionals" | "companies">("professionals");
  const [professionalResults, setProfessionalResults] = useState<any[]>([]);
  const [professionalSearched, setProfessionalSearched] = useState(false);
  const [requestForm, setRequestForm] = useState({
    organization_id: "",
    training_institute_name: "",
    training_institute_email: "",
    training_institute_phone: "",
    training_institute_country: "",
    training_institute_state: "",
    training_institute_address: "",
    training_date: "",
  });
  const [institutes, setInstitutes] = useState<Array<{ id: string; name: string }>>([]);
  const [instituteSearch, setInstituteSearch] = useState("");

  const filteredInstitutes = useMemo(() => {
    const q = instituteSearch.trim().toLowerCase();
    if (!q) return institutes;
    return institutes.filter((inst) => inst.name.toLowerCase().includes(q));
  }, [institutes, instituteSearch]);

  const isOtherInstituteSelected = !requestForm.organization_id;

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

  async function runProfessionalSearch() {
    const q = query.trim();
    if (q.length < 2) {
      toast.error("Enter at least 2 characters");
      return;
    }
    setLoading(true);
    setProfessionalSearched(true);
    try {
      const response =
        professionalMode === "professionals"
          ? await verificationAPI.searchProfessionals({ q, limit: 20 })
          : await verificationAPI.searchCompanies({ q, limit: 20 });
      setProfessionalResults(response.data?.data?.results || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Search failed");
      setProfessionalResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrainingInstitutes() {
    try {
      const response = await verificationAPI.listTrainingInstitutes();
      const rows = response.data?.data?.institutes || [];
      setInstitutes(rows.map((item: any) => ({ id: item.id, name: item.name })));
    } catch {
      setInstitutes([]);
    }
  }

  async function submitManualRequest() {
    try {
      await verificationAPI.submitCompetencyRequest(requestForm);
      toast.success("Verification request submitted");
      setRequestForm({
        organization_id: "",
        training_institute_name: "",
        training_institute_email: "",
        training_institute_phone: "",
        training_institute_country: "",
        training_institute_state: "",
        training_institute_address: "",
        training_date: "",
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not submit request");
    }
  }

  useEffect(() => {
    if (isProfessionalTab && institutes.length === 0) {
      void loadTrainingInstitutes();
    }
  }, [isProfessionalTab, institutes.length]);

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
        <h1 className="marketing-headline mt-3">Project and professional verification portal</h1>
        <p className="marketing-subcopy">Verify solar projects, and check engineer/company competency status from training-institute decisions.</p>

        <div className="mt-6 inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            className={`px-4 py-2 text-sm rounded-lg ${!isProfessionalTab ? "bg-forest-900 text-white" : "text-slate-700"}`}
            onClick={() => void router.replace("/project-verification?tab=project")}
          >
            Project Verification
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm rounded-lg ${isProfessionalTab ? "bg-forest-900 text-white" : "text-slate-700"}`}
            onClick={() => void router.replace("/project-verification?tab=professional")}
          >
            Engineer/Company Verification
          </button>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <input
            className="input flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isProfessionalTab
                ? `Search ${professionalMode === "professionals" ? "professional name/email" : "company name/email"}`
                : "Search by project name, client name, or verification code"
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") void (isProfessionalTab ? runProfessionalSearch() : runSearch());
            }}
          />
          {isProfessionalTab && (
            <select
              className="input sm:max-w-[220px]"
              value={professionalMode}
              onChange={(event) => setProfessionalMode(event.target.value as "professionals" | "companies")}
            >
              <option value="professionals">Professionals</option>
              <option value="companies">Companies</option>
            </select>
          )}
          <button
            type="button"
            className="btn-primary px-5 py-2 inline-flex items-center justify-center gap-2"
            onClick={() => void (isProfessionalTab ? runProfessionalSearch() : runSearch())}
            disabled={loading}
          >
            <RiSearchLine /> {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Need QR verification directly? Use the link on your project QR tag.
        </div>
      </MotionSection>

      {!isProfessionalTab && (
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
      )}

      {isProfessionalTab && (
        <MotionSection className="marketing-section marketing-section-animated">
          {professionalSearched && professionalResults.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No matching professionals/companies were found.
            </div>
          )}

          <div className="space-y-4">
            {professionalResults.map((item, index) => (
              <div key={`${item.id || index}`} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {item.full_name || item.name || [item.first_name, item.last_name].filter(Boolean).join(" ") || "Unknown"}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">{item.email || "No public email"}</p>
                  </div>
                  <span
                    className={`text-xs rounded-full px-2.5 py-1 border ${
                      String(item.professional_status || "").includes("verified")
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {String(
                      item.professional_status_label ||
                        String(item.professional_status || "unverified").replace(/_/g, " ")
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">Request competency verification</h3>
            <p className="text-sm text-slate-500 mt-1">
              Select a registered training institute partner or choose "Other" and provide details.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <select
                className="input"
                value={requestForm.organization_id}
                onChange={(event) =>
                  setRequestForm((prev) => {
                    const organization_id = event.target.value;
                    if (organization_id) {
                      // Selecting a registered institute should not require "other institute" details.
                      return {
                        ...prev,
                        organization_id,
                        training_institute_name: "",
                        training_institute_email: "",
                        training_institute_phone: "",
                        training_institute_country: "",
                        training_institute_state: "",
                        training_institute_address: "",
                      };
                    }
                    return { ...prev, organization_id };
                  })
                }
              >
                <option value="">Other training institute</option>
                {filteredInstitutes.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Search institute..."
                value={instituteSearch}
                onChange={(event) => setInstituteSearch(event.target.value)}
              />
              {isOtherInstituteSelected && (
                <>
                  <input
                    className="input"
                    placeholder="Date of training/graduation (optional)"
                    type="date"
                    value={requestForm.training_date}
                    onChange={(event) => setRequestForm((prev) => ({ ...prev, training_date: event.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Institute name"
                    value={requestForm.training_institute_name}
                    onChange={(event) => setRequestForm((prev) => ({ ...prev, training_institute_name: event.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Institute email"
                    value={requestForm.training_institute_email}
                    onChange={(event) => setRequestForm((prev) => ({ ...prev, training_institute_email: event.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Institute phone"
                    value={requestForm.training_institute_phone}
                    onChange={(event) => setRequestForm((prev) => ({ ...prev, training_institute_phone: event.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Country"
                    value={requestForm.training_institute_country}
                    onChange={(event) => setRequestForm((prev) => ({ ...prev, training_institute_country: event.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="State"
                    value={requestForm.training_institute_state}
                    onChange={(event) => setRequestForm((prev) => ({ ...prev, training_institute_state: event.target.value }))}
                  />
                  <input
                    className="input sm:col-span-2"
                    placeholder="Address"
                    value={requestForm.training_institute_address}
                    onChange={(event) => setRequestForm((prev) => ({ ...prev, training_institute_address: event.target.value }))}
                  />
                </>
              )}
            </div>
            <button type="button" className="btn-primary mt-4" onClick={() => void submitManualRequest()}>
              Submit request
            </button>
          </div>
        </MotionSection>
      )}
    </>
  );
}

ProjectVerificationPortalPage.getLayout = getPublicLayout;
