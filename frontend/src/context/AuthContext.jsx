import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabase';
import { authAPI } from '../services/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [wakingServer, setWakingServer] = useState(false);
  // Prevent the double fetchProfile() caused by getSession() + onAuthStateChange(INITIAL_SESSION) racing
  const profileFetchInFlight = useRef(false);

  useEffect(() => {
    const loadingSafetyTimer = setTimeout(() => {
      setLoading(false);
    }, 10000);

    // onAuthStateChange fires INITIAL_SESSION on mount and handles all subsequent events.
    // We do NOT call fetchProfile() from getSession() to avoid a duplicate concurrent call.
    supabase.auth.getSession().then(({ data: { session } }) => {
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
      setSession(session);
      setUser(session?.user || null);

      if (event === 'SIGNED_OUT') {
        // Only clear the profile on an explicit sign-out, not during token refresh transitions
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
      setUser(data.data);
      setProfileResolved(true);
      setWakingServer(false);
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
            const retry = await authAPI.getMe();
            setProfile(retry.data.data);
            setUser(retry.data.data);
            setProfileResolved(true);
            setWakingServer(false);
          } catch {
            // Keep prior profile if present; if none yet, keep unresolved so guards don't misroute.
            setProfile(prev => prev ?? null);
            setProfileResolved((prev) => prev || !!profile);
          }
        } else {
          setProfile(prev => prev ?? null);
          setProfileResolved((prev) => prev || !!profile);
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
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: metadata,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setProfileResolved(true);
    setWakingServer(false);
  }

  async function refreshProfile() {
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