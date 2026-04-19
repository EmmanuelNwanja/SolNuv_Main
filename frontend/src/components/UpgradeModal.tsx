import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RiArrowRightLine, RiCloseLine, RiLockLine } from "react-icons/ri";
import { type ParsedApiError, titleForPlanBlock } from "../utils/apiErrors";
import { trackEvent } from "../utils/telemetry";

interface PlanBlockedEventDetail {
  parsed: ParsedApiError;
  url: string | null;
}

function resolveUpgradeHref(parsed: ParsedApiError | null): string {
  if (!parsed) return "/plans";
  if (parsed.upgradeUrl && /^https?:\/\//i.test(parsed.upgradeUrl)) {
    try {
      const url = new URL(parsed.upgradeUrl);
      if (url.hostname.endsWith("solnuv.com")) return url.pathname + url.search;
    } catch {
      /* fall through */
    }
  }
  return "/plans";
}

function formatPlanName(plan: string | null): string | null {
  if (!plan) return null;
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export default function UpgradeModal() {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedApiError | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setParsed(null);
  }, []);

  useEffect(() => {
    function onPlanBlocked(ev: Event) {
      const detail = (ev as CustomEvent<PlanBlockedEventDetail>).detail;
      if (!detail?.parsed) return;
      setParsed(detail.parsed);
      setOpen(true);
      trackEvent("plan_blocked", {
        code: detail.parsed.code,
        required_plan: detail.parsed.requiredPlan,
        current_plan: detail.parsed.currentPlan,
        url: detail.url,
        limit: detail.parsed.limit,
        used: detail.parsed.used,
      });
    }
    window.addEventListener("solnuv:plan-blocked", onPlanBlocked);
    return () => window.removeEventListener("solnuv:plan-blocked", onPlanBlocked);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !parsed) return null;

  const title = titleForPlanBlock(parsed);
  const href = resolveUpgradeHref(parsed);
  const required = formatPlanName(parsed.requiredPlan);
  const current = formatPlanName(parsed.currentPlan);
  const showUsage = typeof parsed.limit === "number" && typeof parsed.used === "number";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onClick={close}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1"
          aria-label="Close"
        >
          <RiCloseLine size={22} />
        </button>

        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <RiLockLine className="text-amber-600" size={22} />
          </div>

          <h2 id="upgrade-modal-title" className="font-display font-bold text-xl text-forest-900 mb-2">
            {title}
          </h2>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">{parsed.message}</p>

          {(required || current) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 mb-4 space-y-1">
              {current && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Current plan</span>
                  <span className="font-semibold text-slate-800">{current}</span>
                </div>
              )}
              {required && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Required plan</span>
                  <span className="font-semibold text-emerald-700">{required} or higher</span>
                </div>
              )}
              {showUsage && (
                <div className="flex justify-between">
                  <span className="text-slate-500">This period</span>
                  <span className="font-semibold text-slate-800">
                    {parsed.used} of {parsed.limit} used
                  </span>
                </div>
              )}
              {parsed.period && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Period</span>
                  <span className="font-semibold text-slate-800">{parsed.period}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 mt-5">
            <Link
              href={href}
              onClick={close}
              className="btn-primary py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              View plans <RiArrowRightLine />
            </Link>
            <Link
              href="/pricing"
              onClick={close}
              className="btn-outline py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center"
            >
              Compare pricing
            </Link>
            <button
              type="button"
              onClick={close}
              className="text-xs text-slate-400 hover:text-slate-600 mt-1"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
