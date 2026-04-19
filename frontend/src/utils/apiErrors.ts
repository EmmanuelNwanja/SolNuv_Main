import type { AxiosError } from "axios";

/**
 * Server-returned error codes that signal a plan/quota/access gate.
 * Mirrors backend: subscriptionMiddleware, usageMiddleware, agentMiddleware,
 * verificationMiddleware, adminMiddleware.
 */
export type PlanBlockCode =
  | "PLAN_UPGRADE_REQUIRED"
  | "SUBSCRIPTION_EXPIRED"
  | "TEAM_LIMIT_REACHED"
  | "CALC_LIMIT_EXCEEDED"
  | "SIMULATION_LIMIT_EXCEEDED"
  | "AI_RATE_LIMIT";

export type AccessBlockCode =
  | "VERIFICATION_REQUIRED"
  | "VERIFICATION_PENDING"
  | "VERIFICATION_REJECTED"
  | "PROFILE_INCOMPLETE"
  | "ADMIN_ACCESS_REQUIRED";

export type KnownErrorCode = PlanBlockCode | AccessBlockCode;

const PLAN_BLOCK_CODES: ReadonlySet<string> = new Set<PlanBlockCode>([
  "PLAN_UPGRADE_REQUIRED",
  "SUBSCRIPTION_EXPIRED",
  "TEAM_LIMIT_REACHED",
  "CALC_LIMIT_EXCEEDED",
  "SIMULATION_LIMIT_EXCEEDED",
  "AI_RATE_LIMIT",
]);

export interface ParsedApiError {
  status: number | null;
  code: string | null;
  message: string;
  requiredPlan: string | null;
  currentPlan: string | null;
  upgradeUrl: string | null;
  limit: number | null;
  used: number | null;
  period: string | null;
  actionType: string | null;
  raw: unknown;
}

interface BackendErrorBody {
  success?: boolean;
  message?: string;
  code?: string;
  current_plan?: string;
  required_plan?: string;
  upgrade_url?: string;
  limit?: number;
  used?: number;
  current?: number;
  max?: number;
  period?: string;
  action_type?: string;
  calc_type?: string;
  [key: string]: unknown;
}

function isAxiosError(err: unknown): err is AxiosError<BackendErrorBody> {
  return (
    typeof err === "object" &&
    err !== null &&
    (("isAxiosError" in err && (err as { isAxiosError?: boolean }).isAxiosError === true) ||
      "response" in err ||
      "config" in err)
  );
}

export function parseApiError(err: unknown, fallbackMessage = "Something went wrong"): ParsedApiError {
  if (isAxiosError(err)) {
    const body = (err.response?.data ?? {}) as BackendErrorBody;
    return {
      status: err.response?.status ?? null,
      code: typeof body.code === "string" ? body.code : null,
      message: String(body.message || err.message || fallbackMessage),
      requiredPlan: typeof body.required_plan === "string" ? body.required_plan : null,
      currentPlan: typeof body.current_plan === "string" ? body.current_plan : null,
      upgradeUrl: typeof body.upgrade_url === "string" ? body.upgrade_url : null,
      limit:
        typeof body.limit === "number"
          ? body.limit
          : typeof body.max === "number"
            ? body.max
            : null,
      used:
        typeof body.used === "number"
          ? body.used
          : typeof body.current === "number"
            ? body.current
            : null,
      period: typeof body.period === "string" ? body.period : null,
      actionType:
        typeof body.action_type === "string"
          ? body.action_type
          : typeof body.calc_type === "string"
            ? body.calc_type
            : null,
      raw: err,
    };
  }

  if (err instanceof Error) {
    return {
      status: null,
      code: null,
      message: err.message || fallbackMessage,
      requiredPlan: null,
      currentPlan: null,
      upgradeUrl: null,
      limit: null,
      used: null,
      period: null,
      actionType: null,
      raw: err,
    };
  }

  return {
    status: null,
    code: null,
    message: fallbackMessage,
    requiredPlan: null,
    currentPlan: null,
    upgradeUrl: null,
    limit: null,
    used: null,
    period: null,
    actionType: null,
    raw: err,
  };
}

export function isPlanBlockCode(code: string | null | undefined): code is PlanBlockCode {
  return typeof code === "string" && PLAN_BLOCK_CODES.has(code);
}

export function isPlanBlockError(parsed: ParsedApiError): boolean {
  return isPlanBlockCode(parsed.code);
}

/**
 * Human-friendly title for the upgrade modal, derived from the error code.
 */
export function titleForPlanBlock(parsed: ParsedApiError): string {
  switch (parsed.code) {
    case "SUBSCRIPTION_EXPIRED":
      return "Subscription expired";
    case "TEAM_LIMIT_REACHED":
      return "Team seat limit reached";
    case "CALC_LIMIT_EXCEEDED":
      return "Calculator limit reached";
    case "SIMULATION_LIMIT_EXCEEDED":
      return "Simulation limit reached";
    case "AI_RATE_LIMIT":
      return "AI usage limit reached";
    case "PLAN_UPGRADE_REQUIRED":
    default:
      return parsed.requiredPlan
        ? `Upgrade to ${parsed.requiredPlan.charAt(0).toUpperCase()}${parsed.requiredPlan.slice(1)} required`
        : "Plan upgrade required";
  }
}
