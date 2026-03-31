import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { authAPI } from '../services/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile();
      else setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user || null);
      if (session) {
        await fetchProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile() {
    try {
      const { data } = await authAPI.getMe();
      setProfile(data.data);
      setUser(data.data);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'PROFILE_INCOMPLETE') {
        setProfile({ is_onboarded: false });
      } else {
        // Profile not yet created or temporarily unavailable
        setProfile(null);
      }
    } finally {
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