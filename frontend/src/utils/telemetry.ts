/**
 * Lightweight client-side telemetry.
 *
 * We intentionally avoid a hard dependency on any specific analytics provider
 * (Segment / Amplitude / Mixpanel / etc.). Instead we:
 *
 *   1. Log events to the debug console when NEXT_PUBLIC_TELEMETRY_DEBUG is set.
 *   2. Dispatch a `solnuv:telemetry` CustomEvent that any provider glue code
 *      in `_app.tsx` or a future provider-specific adapter can listen to.
 *
 * This lets product & data teams wire a real backend/provider later without
 * touching the call sites.
 */

export type TelemetryEvent =
  | "plan_blocked"
  | "checkout_started"
  | "checkout_submitted"
  | "simulation_completed"
  | "pricing_viewed";

export interface TelemetryPayload {
  [key: string]: unknown;
}

const DEBUG_ENABLED =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_TELEMETRY_DEBUG === "1";

export function trackEvent(event: TelemetryEvent, payload: TelemetryPayload = {}): void {
  if (typeof window === "undefined") return;

  const enriched: TelemetryPayload = {
    ...payload,
    ts: new Date().toISOString(),
    path: window.location?.pathname ?? null,
  };

  if (DEBUG_ENABLED) {
    console.debug("[solnuv:telemetry]", event, enriched);
  }

  try {
    window.dispatchEvent(
      new CustomEvent("solnuv:telemetry", { detail: { event, payload: enriched } })
    );
  } catch {
    /* ignore — event dispatching should never break a user action */
  }
}
