import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { authAPI } from '../services/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  // Track if we've done the first load — prevents flicker on token refresh
  const initialLoadDone = useRef(false);
  const fetchingProfile = useRef(false);

  useEffect(() => {
    // Get initial session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user || null);
      if (session) {
        fetchProfile();
      } else {
        setLoading(false);
        initialLoadDone.current = true;
      }
    });

    // Listen for auth state changes (token refresh, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user || null);

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setLoading(false);
          return;
        }

        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (session) {
            // Don't set loading=true on token refresh — avoids the flicker
            // that causes the onboarding redirect
            await fetchProfile(false);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // setLoadingState=true only on first load, not on background refreshes
  async function fetchProfile(setLoadingState = true) {
    // Prevent concurrent fetches
    if (fetchingProfile.current) return;
    fetchingProfile.current = true;

    if (setLoadingState && !initialLoadDone.current) {
      setLoading(true);
    }

    try {
      const { data } = await authAPI.getMe();
      const fetchedProfile = data.data;

      setProfile(fetchedProfile);
      setUser(fetchedProfile);
    } catch (err) {
      // IMPORTANT: on network error or 401, don't wipe the existing profile
      // Only clear profile on explicit sign-out
      if (err?.response?.status === 401) {
        setProfile(null);
      }
      // For all other errors (network blip, timeout), keep existing profile
      // so the user isn't bounced to onboarding
    } finally {
      fetchingProfile.current = false;
      setLoading(false);
      initialLoadDone.current = true;
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

  async function signUpWithEmail(email, password) {
    return supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    setProfile(null);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    await fetchProfile(false);
  }

  const isOnboarded = profile?.is_onboarded === true;
  const plan = profile?.companies?.subscription_plan || 'free';
  const isPro = ['pro', 'elite', 'enterprise'].includes(plan);
  const isElite = ['elite', 'enterprise'].includes(plan);
  const company = profile?.companies;

  return (
    <AuthContext.Provider value={{
      user, profile, session, loading,
      isOnboarded, plan, isPro, isElite, company,
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