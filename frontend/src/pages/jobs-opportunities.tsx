import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RiBriefcaseLine,
  RiCalendarEventLine,
  RiMapPinLine,
  RiMedalLine,
  RiRocketLine,
  RiSendPlaneLine,
  RiTimeLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import { getPublicLayout } from "../components/Layout";
import { MotionItem, MotionSection, MotionStagger } from "../components/PageMotion";
import { opportunitiesAPI } from "../services/api";
import { supabase } from "../utils/supabase";
import { useAuth } from "../context/AuthContext";

type Opportunity = {
  id: string;
  type: "job" | "contest" | "opportunity";
  status: "live" | "coming_soon" | "ended";
  title: string;
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
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function typeMeta(type: Opportunity["type"]) {
  if (type === "job") return { label: "Job", icon: RiBriefcaseLine };
  if (type === "contest") return { label: "Contest", icon: RiMedalLine };
  return { label: "Opportunity", icon: RiRocketLine };
}

function statusClass(status: Opportunity["status"]) {
  if (status === "live") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "coming_soon") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function emptyForm() {
  return {
    applicant_name: "",
    applicant_email: "",
    applicant_phone: "",
    applicant_company: "",
    applicant_message: "",
    resume_url: "",
    resume_filename: "",
    portfolio_url: "",
    portfolio_label: "",
  };
}

export default function JobsOpportunitiesPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | Opportunity["status"]>("all");
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, ReturnType<typeof emptyForm>>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [uploadingResumeId, setUploadingResumeId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await opportunitiesAPI.listPublic();
        if (!mounted) return;
        setItems((data.data || []) as Opportunity[]);
      } catch {
        toast.error("Failed to load opportunities");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => item.status === activeFilter);
  }, [activeFilter, items]);

  function formFor(id: string) {
    return forms[id] || emptyForm();
  }

  function updateForm(id: string, key: keyof ReturnType<typeof emptyForm>, value: string) {
    setForms((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || emptyForm()),
        [key]: value,
      },
    }));
  }

  async function submitApplication(opportunity: Opportunity) {
    const form = formFor(opportunity.id);
    if (!form.applicant_name.trim() || !form.applicant_email.trim()) {
      toast.error("Please provide your name and email");
      return;
    }

    try {
      setSubmittingId(opportunity.id);
      await opportunitiesAPI.apply(opportunity.id, form);
      toast.success("Application submitted");
      setForms((prev) => ({ ...prev, [opportunity.id]: emptyForm() }));
      setOpenFormId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Submission failed");
    } finally {
      setSubmittingId(null);
    }
  }

  async function uploadResume(opportunityId: string, file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("CV file must be less than 10MB");
      return;
    }
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF or Word documents are allowed");
      return;
    }
    try {
      setUploadingResumeId(opportunityId);
      const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const ownerPrefix = profile?.id || "public";
      const path = `${ownerPrefix}/${opportunityId}/${safeName}`;
      const { error } = await supabase.storage.from("job-applications").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        toast.error(error.message || "CV upload failed");
        return;
      }
      const { data } = supabase.storage.from("job-applications").getPublicUrl(path);
      updateForm(opportunityId, "resume_url", data.publicUrl);
      updateForm(opportunityId, "resume_filename", file.name);
      toast.success("CV uploaded");
    } catch {
      toast.error("CV upload failed");
    } finally {
      setUploadingResumeId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Jobs & Opportunities | SolNuv</title>
      </Head>

      <MotionSection className="marketing-section marketing-section-animated">
        <span className="marketing-kicker">Resources</span>
        <h1 className="marketing-headline mt-3">Jobs, contests, and opportunities</h1>
        <p className="marketing-subcopy">
          Discover live openings, upcoming programs, and ecosystem opportunities. Apply to jobs directly from each listing and register your interest where applicable.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { key: "all", label: "All" },
            { key: "live", label: "Live" },
            { key: "coming_soon", label: "Coming soon" },
            { key: "ended", label: "Ended" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key as "all" | Opportunity["status"])}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                activeFilter === f.key
                  ? "bg-forest-900 text-white border-forest-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </MotionSection>

      <MotionSection className="marketing-section marketing-section-animated">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No opportunities available for this filter right now.
          </div>
        ) : (
          <MotionStagger className="space-y-4" delay={0.02}>
            {visibleItems.map((item) => {
              const meta = typeMeta(item.type);
              const TypeIcon = meta.icon;
              const isFormOpen = openFormId === item.id;
              const canApply = item.type === "job" && item.status === "live";
              return (
                <MotionItem key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 reveal-lift">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      <TypeIcon /> {meta.label}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusClass(item.status)}`}>
                      {item.status === "coming_soon" ? "Coming soon" : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold text-slate-900 mt-3">{item.title}</h2>
                  {item.summary && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.summary}</p>}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                    {item.location && (
                      <span className="inline-flex items-center gap-1">
                        <RiMapPinLine /> {item.location}
                      </span>
                    )}
                    {item.employment_type && (
                      <span className="inline-flex items-center gap-1">
                        <RiBriefcaseLine /> {item.employment_type}
                      </span>
                    )}
                    {item.application_deadline && (
                      <span className="inline-flex items-center gap-1">
                        <RiTimeLine /> Apply by {formatDate(item.application_deadline)}
                      </span>
                    )}
                    {item.starts_at && (
                      <span className="inline-flex items-center gap-1">
                        <RiCalendarEventLine /> Starts {formatDate(item.starts_at)}
                      </span>
                    )}
                  </div>

                  {item.details && (
                    <div className="mt-3 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{item.details}</div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canApply && (
                      <button
                        type="button"
                        onClick={() => setOpenFormId((v) => (v === item.id ? null : item.id))}
                        className="btn-primary px-4 py-2 text-xs"
                      >
                        {isFormOpen ? "Close application form" : "Apply / Express interest"}
                      </button>
                    )}

                    {!canApply && item.status !== "ended" && (
                      <button
                        type="button"
                        onClick={() => setOpenFormId((v) => (v === item.id ? null : item.id))}
                        className="btn-outline px-4 py-2 text-xs"
                      >
                        Express interest
                      </button>
                    )}

                    {item.cta_url && (
                      <Link href={item.cta_url} className="btn-outline px-4 py-2 text-xs">
                        {item.cta_label || "Learn more"}
                      </Link>
                    )}
                  </div>

                  {isFormOpen && item.status !== "ended" && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          className="input"
                          placeholder="Full name"
                          value={formFor(item.id).applicant_name}
                          onChange={(e) => updateForm(item.id, "applicant_name", e.target.value)}
                        />
                        <input
                          className="input"
                          type="email"
                          placeholder="Email"
                          value={formFor(item.id).applicant_email}
                          onChange={(e) => updateForm(item.id, "applicant_email", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          className="input"
                          placeholder="Phone (optional)"
                          value={formFor(item.id).applicant_phone}
                          onChange={(e) => updateForm(item.id, "applicant_phone", e.target.value)}
                        />
                        <input
                          className="input"
                          placeholder="Organization / company (optional)"
                          value={formFor(item.id).applicant_company}
                          onChange={(e) => updateForm(item.id, "applicant_company", e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="input flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-slate-600 truncate">
                            {formFor(item.id).resume_filename || "Upload CV (PDF/DOCX)"}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void uploadResume(item.id, file);
                            }}
                            disabled={uploadingResumeId === item.id}
                          />
                        </label>
                        <input
                          className="input"
                          placeholder="Portfolio URL (optional)"
                          value={formFor(item.id).portfolio_url}
                          onChange={(e) => updateForm(item.id, "portfolio_url", e.target.value)}
                        />
                      </div>
                      {uploadingResumeId === item.id && (
                        <p className="text-xs text-slate-500">Uploading CV...</p>
                      )}
                      <textarea
                        className="input resize-y"
                        rows={3}
                        placeholder="Tell us your interest / relevant background"
                        value={formFor(item.id).applicant_message}
                        onChange={(e) => updateForm(item.id, "applicant_message", e.target.value)}
                      />

                      <button
                        type="button"
                        className="btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5"
                        disabled={submittingId === item.id}
                        onClick={() => void submitApplication(item)}
                      >
                        <RiSendPlaneLine />
                        {submittingId === item.id ? "Submitting..." : "Submit"}
                      </button>
                    </div>
                  )}
                </MotionItem>
              );
            })}
          </MotionStagger>
        )}
      </MotionSection>
    </>
  );
}

JobsOpportunitiesPage.getLayout = getPublicLayout;
