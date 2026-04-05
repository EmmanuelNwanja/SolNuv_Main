import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getAuthCallbackUrl, supabase } from '../utils/supabase';
import { authAPI } from '../services/api';

const AuthContext = createContext({});

// ---------------------------------------------------------------------------
// Lightweight profile cache — survives page refreshes and cold-start failures.
// Cleared on explicit sign-out so stale data is never shown after log-out.
// ---------------------------------------------------------------------------
const PROFILE_CACHE_KEY = 'solnuv_profile_v1';
function readProfileCache() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null'); } catch { return null; }
}
function getMatchingCachedProfile(sessionUser) {
  const cached = readProfileCache();
  if (!cached || !sessionUser) return null;

  const sessionEmail = String(sessionUser.email || '').toLowerCase();
  const cachedEmail = String(cached.email || '').toLowerCase();
  if (sessionUser.id && cached.supabase_uid && sessionUser.id === cached.supabase_uid) return cached;
  if (sessionEmail && cachedEmail && sessionEmail === cachedEmail) return cached;
  return null;
}
function writeProfileCache(data) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data)); } catch {}
}
function clearProfileCache() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [wakingServer, setWakingServer] = useState(false);
  // Prevent the double fetchProfile() caused by getSession() + onAuthStateChange(INITIAL_SESSION) racing
  const profileFetchInFlight = useRef(false);
  const activeSessionUserRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const hasAuthCode = url.searchParams.has('code');
      const hasAuthError = url.searchParams.has('error') || url.searchParams.has('error_description');
      const hasHashTokens = /access_token|refresh_token|provider_token|token_type/.test(url.hash || '');
      const isCallbackRoute = url.pathname === '/auth/callback';

      if (!isCallbackRoute && (hasAuthCode || hasAuthError || hasHashTokens)) {
        window.location.replace(`/auth/callback${url.search}${url.hash}`);
        return undefined;
      }
    }

    const loadingSafetyTimer = setTimeout(() => {
      // Hard deadline: if auth hasn't resolved in 8s, unblock the UI.
      // Use cached profile so the user stays logged in during a slow cold-start.
      const cached = getMatchingCachedProfile(activeSessionUserRef.current);
      if (cached) {
        setProfile(prev => prev ?? cached);
      }
      setProfileResolved(true);   // ← critical: clears the ProtectedRoute spinner
      setWakingServer(false);
      setLoading(false);
    }, 8000);

    // onAuthStateChange fires INITIAL_SESSION on mount and handles all subsequent events.
    // We do NOT call fetchProfile() from getSession() to avoid a duplicate concurrent call.
    supabase.auth.getSession().then(({ data: { session } }) => {
      activeSessionUserRef.current = session?.user || null;
      setSession(session);
      setUser(session?.user || null);
      // If onAuthStateChange hasn't fired yet (race), kick off the fetch here as a fallback.
      // The in-flight ref prevents a double call when both fire close together.
      if (session && !profileFetchInFlight.current) fetchProfile();
      else if (!session) {
        setProfileResolved(true);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      activeSessionUserRef.current = session?.user || null;
      setSession(session);
      setUser(session?.user || null);

      if (event === 'SIGNED_OUT') {
        // Clear profile and cache on any sign-out (explicit or externally triggered,
        // e.g. another tab signing out, Supabase token revocation, admin force-logout).
        clearProfileCache();
        setProfile(null);
        setProfileResolved(true);
        setWakingServer(false);
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Session updated but user is still logged in — no need to re-fetch profile
        return;
      }

      if (session) {
        await fetchProfile();
      } else {
        setProfileResolved(true);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(loadingSafetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile() {
    if (profileFetchInFlight.current) return;
    profileFetchInFlight.current = true;
    try {
      const { data } = await authAPI.getMe();
      setProfile(data.data);
      setProfileResolved(true);
      setWakingServer(false);
      writeProfileCache(data.data); // persist for cold-start resilience
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'PROFILE_INCOMPLETE') {
        setProfile({ is_onboarded: false });
        setProfileResolved(true);
        setWakingServer(false);
      } else {
        const status = err?.response?.status;
        const isTransient = !status || status >= 500 || err?.code === 'ECONNABORTED';

        if (isTransient) {
          // Render free-tier cold starts can delay the first request.
          // Show a clear waking state, ping health endpoint, then retry once.
          setWakingServer(true);
          try {
            await authAPI.wakeBackend();
            const retry = await authAPI.getMeQuick();
            setProfile(retry.data.data);
            setProfileResolved(true);
            setWakingServer(false);
            writeProfileCache(retry.data.data); // persist for cold-start resilience
          } catch {
            // Both attempts failed — fall back to cached profile so the user
            // stays "logged in" during a prolonged outage instead of seeing an
            // infinite spinner or being forced to the login page.
            const cached = getMatchingCachedProfile(activeSessionUserRef.current);
            if (cached) {
              setProfile(cached);
            } else {
              setProfile(null);
            }
            setProfileResolved(true); // always unblock ProtectedRoute
            setWakingServer(false);
          }
        } else {
          // Non-transient error (e.g. 401 with bad token) — resolve immediately
          // so guards can redirect rather than spinning indefinitely.
          const cached = getMatchingCachedProfile(activeSessionUserRef.current);
          setProfile(prev => prev ?? cached ?? null);
          setProfileResolved(true);
        }
      }
    } finally {
      profileFetchInFlight.current = false;
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthCallbackUrl() },
    });
  }

  async function signInWithEmail(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signUpWithEmail(email, password, metadata = {}) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
        data: metadata,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    clearProfileCache();
    setUser(null);
    setProfile(null);
    setSession(null);
    setProfileResolved(true);
    setWakingServer(false);
  }

  async function refreshProfile() {
    // Force a fresh fetch even if another fetch is nominally in-flight.
    // Without this reset, a call from Settings after saving profile could be
    // silently dropped if the auth system's initial fetch hasn't fully settled.
    profileFetchInFlight.current = false;
    await fetchProfile();
  }

  const isOnboarded = profile?.is_onboarded === true;
  const plan = profile?.companies?.subscription_plan || 'free';
  const isPro = ['pro', 'elite', 'enterprise'].includes(plan);
  const isElite = ['elite', 'enterprise'].includes(plan);
  const company = profile?.companies;
  const isPlatformAdmin = profile?.is_platform_admin === true;
  const platformAdminRole = profile?.platform_admin_role || null;

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading,
      profileResolved, wakingServer,
      isOnboarded, plan, isPro, isElite, company,
      isPlatformAdmin, platformAdminRole,
      signInWithGoogle, signInWithEmail, signUpWithEmail,
      signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};