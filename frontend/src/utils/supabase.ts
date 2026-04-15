import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const normalized = configured
      .replace(/\/$/, "")
      .replace(/^https?:\/\/www\./, "https://");
    return normalized;
  }
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/^https?:\/\/www\./, "https://");
  }
  return "https://solnuv.com";
}

export function getAuthCallbackUrl(): string {
  return `${getAppUrl()}/auth/callback`;
}

if (!supabaseUrl || !supabaseAnonKey) {
  // Keeping this runtime warning helps catch broken deployments quickly.
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Supabase client will not function."
  );
}

// Placeholders allow `next build` / prerender when env vars are not injected in CI.
// Runtime still logs above if real credentials are missing in production.
const resolvedUrl = supabaseUrl?.trim() || "https://placeholder.supabase.co";
const resolvedKey =
  supabaseAnonKey?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder-build-only";

export const supabase = createClient(resolvedUrl, resolvedKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
