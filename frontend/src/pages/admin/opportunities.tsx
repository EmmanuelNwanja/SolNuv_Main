import Head from "next/head";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RiAddLine, RiCloseLine, RiDeleteBinLine, RiEditLine, RiFlagLine, RiListCheck3, RiSaveLine } from "react-icons/ri";
import toast from "react-hot-toast";
import AdminRoute from "../../components/AdminRoute";
import { getAdminLayout } from "../../components/Layout";
import { opportunitiesAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

type Opportunity = {
  id: string;
  type: "job" | "contest" | "opportunity";
  status: "live" | "coming_soon" | "ended";
  title: string;
  slug: string;
  summary?: string | null;
  details?: string | null;
  location?: string | null;
  department?: string | null;
  employment_type?: string | null;
  compensation?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  application_deadline?: string | null;
  sort_order: number;
  is_published: boolean;
};

type Application = {
  id: string;
  opportunity_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string | null;
  applicant_company?: string | null;
  applicant_message?: string | null;
  resume_url?: string | null;
  resume_filename?: string | null;
  portfolio_url?: string | null;
  portfolio_label?: string | null;
  status: "new" | "reviewing" | "shortlisted" | "rejected" | "accepted";
  created_at: string;
  opportunities?: { title?: string; type?: string; status?: string } | null;
};

function emptyOpportunity() {
  return {
    type: "job",
    status: "coming_soon",
    title: "",
    slug: "",
    summary: "",
    details: "",
    location: "",
    department: "",
    employment_type: "",
    compensation: "",
    cta_label: "",
    cta_url: "",
    starts_at: "",
    ends_at: "",
    application_deadline: "",
    sort_order: 0,
    is_published: false,
  };
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl mt-8">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <RiCloseLine className="text-xl" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function OpportunityForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial?: Partial<ReturnType<typeof emptyOpportunity>>;
  saving: boolean;
  onSave: (payload: ReturnType<typeof emptyOpportunity>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...emptyOpportunity(), ...(initial || {}) });
  function set<K extends keyof ReturnType<typeof emptyOpportunity>>(k: K, v: ReturnType<typeof emptyOpportunity>[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type} onChange={(e) => set("type", e.target.value as any)}>
            <option value="job">Job</option>
            <option value="contest">Contest</option>
            <option value="opportunity">Opportunity</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={(e) => set("status", e.target.value as any)}>
            <option value="live">Live</option>
            <option value="coming_soon">Coming soon</option>
            <option value="ended">Ended</option>
          </select>
        </div>
        <div>
          <label className="label">Sort order</label>
          <input className="input" type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Title *</label>
          <input
            className="input"
            required
            value={form.title}
            onChange={(e) => {
              const title = e.target.value;
              set("title", title);
              if (!initial?.slug) {
                set("slug", title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
              }
            }}
          />
        </div>
        <div>
          <label className="label">Slug *</label>
          <input className="input font-mono text-xs" required value={form.slug} onChange={(e) => set("slug", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Summary</label>
        <textarea className="input resize-y" rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
      </div>
      <div>
        <label className="label">Details</label>
        <textarea className="input resize-y" rows={6} value={form.details} onChange={(e) => set("details", e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} />
        </div>
        <div>
          <label className="label">Department</label>
          <input className="input" value={form.department} onChange={(e) => set("department", e.target.value)} />
        </div>
        <div>
          <label className="label">Employment type</label>
          <input className="input" value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)} />
        </div>
        <div>
          <label className="label">Compensation</label>
          <input className="input" value={form.compensation} onChange={(e) => set("compensation", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">External CTA label</label>
          <input className="input" value={form.cta_label} onChange={(e) => set("cta_label", e.target.value)} />
        </div>
        <div>
          <label className="label">External CTA URL</label>
          <input className="input" value={form.cta_url} onChange={(e) => set("cta_url", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Starts at</label>
          <input className="input" type="datetime-local" value={form.starts_at || ""} onChange={(e) => set("starts_at", e.target.value)} />
        </div>
        <div>
          <label className="label">Ends at</label>
          <input className="input" type="datetime-local" value={form.ends_at || ""} onChange={(e) => set("ends_at", e.target.value)} />
        </div>
        <div>
          <label className="label">Application deadline</label>
          <input className="input" type="datetime-local" value={form.application_deadline || ""} onChange={(e) => set("application_deadline", e.target.value)} />
        </div>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" className="accent-emerald-500" checked={!!form.is_published} onChange={(e) => set("is_published", e.target.checked)} />
        Published
      </label>
      <div className="flex gap-3 pt-2">
        <button type="button" className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-300" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          <RiSaveLine /> {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function statusBadge(status: Opportunity["status"]) {
  if (status === "live") return "bg-emerald-900/30 text-emerald-400 border-emerald-800";
  if (status === "coming_soon") return "bg-amber-900/30 text-amber-400 border-amber-800";
  return "bg-slate-700 text-slate-300 border-slate-600";
}

function AdminOpportunitiesPage() {
  const { platformAdminRole } = useAuth();
  const canEdit = ["super_admin", "operations"].includes(platformAdminRole || "");

  const [tab, setTab] = useState<"listings" | "applications">("listings");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<null | "create" | Opportunity>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>("");
  const [applicationSearch, setApplicationSearch] = useState("");
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<string>("");
  const [applicationsPage, setApplicationsPage] = useState(1);
  const [applicationsLimit] = useState(20);
  const [applicationsPagination, setApplicationsPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 1,
    has_next: false,
    has_prev: false,
  });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await opportunitiesAPI.adminList();
      setItems((data.data || []) as Opportunity[]);
    } catch {
      toast.error("Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: applicationsPage,
        limit: applicationsLimit,
      };
      if (selectedOpportunityId) params.opportunity_id = selectedOpportunityId;
      if (applicationStatusFilter) params.status = applicationStatusFilter;
      if (applicationSearch.trim()) params.q = applicationSearch.trim();
      const { data } = await opportunitiesAPI.adminListApplications(params);
      setApplications((data.data || []) as Application[]);
      if (data.pagination) {
        setApplicationsPagination(data.pagination);
      }
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [applicationsLimit, applicationsPage, applicationSearch, applicationStatusFilter, selectedOpportunityId]);

  useEffect(() => {
    if (tab === "listings") void loadItems();
    else void loadApplications();
  }, [tab, loadItems, loadApplications]);

  useEffect(() => {
    setApplicationsPage(1);
  }, [selectedOpportunityId, applicationSearch, applicationStatusFilter]);

  const stats = useMemo(
    () => ({
      total: items.length,
      live: items.filter((i) => i.status === "live").length,
      comingSoon: items.filter((i) => i.status === "coming_soon").length,
      ended: items.filter((i) => i.status === "ended").length,
    }),
    [items]
  );

  async function saveOpportunity(payload: ReturnType<typeof emptyOpportunity>) {
    try {
      setSaving(true);
      if (modal === "create") {
        await opportunitiesAPI.adminCreate(payload);
        toast.success("Opportunity created");
      } else if (modal && typeof modal === "object") {
        await opportunitiesAPI.adminUpdate(modal.id, payload);
        toast.success("Opportunity updated");
      }
      setModal(null);
      await loadItems();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOpportunity(id: string) {
    if (!confirm("Delete this listing?")) return;
    try {
      await opportunitiesAPI.adminDelete(id);
      toast.success("Deleted");
      await loadItems();
    } catch {
      toast.error("Failed to delete listing");
    }
  }

  async function updateApplicationStatus(id: string, status: Application["status"]) {
    try {
      await opportunitiesAPI.adminUpdateApplication(id, { status });
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      toast.success("Application updated");
    } catch {
      toast.error("Failed to update application");
    }
  }

  return (
    <>
      <Head>
        <title>Opportunities Management | SolNuv Admin</title>
      </Head>

      <div className="max-w-screen-xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Jobs, Contests & Opportunities</h1>
            <p className="text-sm text-slate-400">Create listings, track lifecycle status, and review applications.</p>
          </div>
          {canEdit && tab === "listings" && (
            <button type="button" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2" onClick={() => setModal("create")}>
              <RiAddLine /> New listing
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3"><p className="text-xs text-slate-400">Total</p><p className="text-lg text-white font-semibold">{stats.total}</p></div>
          <div className="bg-slate-900 border border-emerald-900/50 rounded-xl p-3"><p className="text-xs text-slate-400">Live</p><p className="text-lg text-emerald-400 font-semibold">{stats.live}</p></div>
          <div className="bg-slate-900 border border-amber-900/50 rounded-xl p-3"><p className="text-xs text-slate-400">Coming soon</p><p className="text-lg text-amber-400 font-semibold">{stats.comingSoon}</p></div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3"><p className="text-xs text-slate-400">Ended</p><p className="text-lg text-slate-300 font-semibold">{stats.ended}</p></div>
        </div>

        <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl w-fit">
          <button type="button" onClick={() => setTab("listings")} className={`px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${tab === "listings" ? "bg-slate-700 text-white" : "text-slate-400"}`}><RiFlagLine /> Listings</button>
          <button type="button" onClick={() => setTab("applications")} className={`px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${tab === "applications" ? "bg-slate-700 text-white" : "text-slate-400"}`}><RiListCheck3 /> Applications</button>
        </div>

        {tab === "listings" ? (
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />)}</div>
            ) : items.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-sm text-slate-400 text-center">No listings yet.</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{item.title}</p>
                    <p className="text-xs text-slate-400 font-mono">{item.slug}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="text-[11px] rounded-full px-2 py-0.5 border border-slate-700 text-slate-300">{item.type}</span>
                      <span className={`text-[11px] rounded-full px-2 py-0.5 border ${statusBadge(item.status)}`}>{item.status.replace("_", " ")}</span>
                      <span className={`text-[11px] rounded-full px-2 py-0.5 border ${item.is_published ? "border-emerald-700 text-emerald-400" : "border-slate-700 text-slate-400"}`}>
                        {item.is_published ? "published" : "draft"}
                      </span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button type="button" className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white" onClick={() => setModal(item)}><RiEditLine /></button>
                      <button type="button" className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400" onClick={() => void deleteOpportunity(item.id)}><RiDeleteBinLine /></button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <select className="input !h-9 !py-1.5 !text-xs max-w-[320px]" value={selectedOpportunityId} onChange={(e) => setSelectedOpportunityId(e.target.value)}>
                <option value="">All listings</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <select
                className="input !h-9 !py-1.5 !text-xs max-w-[180px]"
                value={applicationStatusFilter}
                onChange={(e) => setApplicationStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="new">new</option>
                <option value="reviewing">reviewing</option>
                <option value="shortlisted">shortlisted</option>
                <option value="rejected">rejected</option>
                <option value="accepted">accepted</option>
              </select>
              <input
                className="input !h-9 !py-1.5 !text-xs max-w-[220px]"
                placeholder="Search name/email/company"
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
              />
              <button type="button" className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs" onClick={() => void loadApplications()}>
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />)}</div>
            ) : applications.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-sm text-slate-400 text-center">No applications yet.</div>
            ) : (
              applications.map((app) => (
                <div key={app.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold">{app.applicant_name}</p>
                      <p className="text-xs text-slate-400">{app.applicant_email}{app.applicant_phone ? ` · ${app.applicant_phone}` : ""}</p>
                      <p className="text-xs text-slate-500 mt-1">{app.opportunities?.title || "Unknown listing"}</p>
                      {app.applicant_message && <p className="text-xs text-slate-300 mt-2 max-w-3xl">{app.applicant_message}</p>}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs">
                        {app.resume_url && (
                          <a href={app.resume_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">
                            CV: {app.resume_filename || "Open"}
                          </a>
                        )}
                        {app.portfolio_url && (
                          <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                            {app.portfolio_label || "Portfolio"}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select className="input !h-8 !py-1 !text-xs" value={app.status} onChange={(e) => void updateApplicationStatus(app.id, e.target.value as Application["status"])}>
                        <option value="new">new</option>
                        <option value="reviewing">reviewing</option>
                        <option value="shortlisted">shortlisted</option>
                        <option value="rejected">rejected</option>
                        <option value="accepted">accepted</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))
            )}
            {!loading && applicationsPagination.pages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                <span>
                  Page {applicationsPagination.page} of {applicationsPagination.pages} · {applicationsPagination.total} results
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border border-slate-700 disabled:opacity-50"
                    disabled={!applicationsPagination.has_prev}
                    onClick={() => setApplicationsPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded border border-slate-700 disabled:opacity-50"
                    disabled={!applicationsPagination.has_next}
                    onClick={() => setApplicationsPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modal !== null && (
        <Modal title={modal === "create" ? "New listing" : "Edit listing"} onClose={() => setModal(null)}>
          <OpportunityForm
            initial={modal === "create" ? undefined : modal}
            saving={saving}
            onSave={(payload) => void saveOpportunity(payload)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </>
  );
}

AdminOpportunitiesPage.getLayout = getAdminLayout;

export default function AdminOpportunitiesPageWrapper() {
  return (
    <AdminRoute requiredRoles={["super_admin", "operations", "analytics"]}>
      <AdminOpportunitiesPage />
    </AdminRoute>
  );
}

AdminOpportunitiesPageWrapper.getLayout = getAdminLayout;
