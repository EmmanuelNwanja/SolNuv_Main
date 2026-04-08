import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const normalized = configured.replace(/\/$/, '');
    // Prevent apex/www callback mismatches in production OAuth configuration.
    if (normalized === 'https://solnuv.com' || normalized === 'http://solnuv.com') {
      return 'https://www.solnuv.com';
    }
    return normalized;
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://www.solnuv.com';
}

export function getAuthCallbackUrl() {
  return `${getAppUrl()}/auth/callback`;
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[supabase] NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Supabase client will not function.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
