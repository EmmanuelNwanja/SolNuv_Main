import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getAuthCallbackUrl, supabase } from "../utils/supabase";
import { authAPI } from "../services/api";
import type { AppUserProfile } from "../types/contracts";

const PROFILE_CACHE_KEY = "solnuv_profile_v1";

function readProfileCache(): AppUserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "null") as AppUserProfile | null;
  } catch {
    return null;
  }
}

function getMatchingCachedProfile(sessionUser: User | null): AppUserProfile | null {
  const cached = readProfileCache();
  if (!cached || !sessionUser) return null;

  const sessionEmail = String(sessionUser.email || "").toLowerCase();
  const cachedEmail = String(cached.email || "").toLowerCase();
  if (sessionUser.id && cached.supabase_uid && sessionUser.id === cached.supabase_uid) return cached;
  if (sessionUser.id && cached.supabase_uid && sessionUser.id !== cached.supabase_uid) return null;
  if (sessionEmail && cachedEmail && sessionEmail === cachedEmail) return cached;
  return null;
}

function writeProfileCache(data: AppUserProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function clearProfileCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function isAxiosLike(err: unknown): err is {
  response?: { status?: number; data?: { code?: string; message?: string } };
  code?: string;
  message?: string;
} {
  return typeof err === "object" && err !== null;
}

export interface AuthContextValue {
  user: User | null;
  profile: AppUserProfile | null;
  session: Session | null;
  loading: boolean;
  profileResolved: boolean;
  wakingServer: boolean;
  isOnboarded: boolean;
  plan: string;
  isPro: boolean;
  isElite: boolean;
  isBasic: boolean;
  isFree: boolean;
  isInGracePeriod: boolean;
  graceUntil: string | null;
  company: AppUserProfile["companies"];
  isPlatformAdmin: boolean;
  platformAdminRole: string | null;
  verificationStatus: string;
  isVerified: boolean;
  signInWithGoogle: () => ReturnType<typeof supabase.auth.signInWithOAuth>;
  signInWithEmail: (email: string, password: string) => ReturnType<typeof supabase.auth.signInWithPassword>;
  signUpWithEmail: (
    email: string,
    password: string,
    metadata?: Record<string, string>
  ) => Promise<{ data: unknown; error: { message: string; status: number } | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (value: SetStateAction<AppUserProfile | null>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [wakingServer, setWakingServer] = useState(false);
  const profileFetchInFlight = useRef(false);
  const activeSessionUserRef = useRef<User | null>(null);
  const profileRef = useRef<AppUserProfile | null>(null);
  profileRef.current = profile;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const hasAuthCode = url.searchParams.has("code");
      const hasAuthError = url.searchParams.has("error") || url.searchParams.has("error_description");
      const hasHashTokens = /access_token|refresh_token|provider_token|token_type/.test(url.hash || "");
      const isCallbackRoute = url.pathname === "/auth/callback";

      if (!isCallbackRoute && (hasAuthCode || hasAuthError || hasHashTokens)) {
        window.location.replace(`/auth/callback${url.search}${url.hash}`);
        return undefined;
      }
    }

    const loadingSafetyTimer = setTimeout(() => {
      if (profileFetchInFlight.current) return;
      const cached = getMatchingCachedProfile(activeSessionUserRef.current);
      if (cached) {
        setProfile((prev) => prev ?? cached);
      }
      setProfileResolved(true);
      setWakingServer(false);
      setLoading(false);
    }, 8000);

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      activeSessionUserRef.current = initialSession?.user ?? null;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession && !profileFetchInFlight.current) {
        const p = profileRef.current;
        if (!p || !p.is_onboarded) {
          void fetchProfile();
        } else {
          setProfileResolved(true);
          setLoading(false);
        }
      } else if (!initialSession) {
        setProfileResolved(true);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      activeSessionUserRef.current = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (event === "SIGNED_OUT") {
        clearProfileCache();
        setProfile(null);
        setProfileResolved(true);
        setWakingServer(false);
        setLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        return;
      }

      if (nextSession) {
        const p = profileRef.current;
        if (!p || !p.is_onboarded) {
          void fetchProfile();
        } else {
          setProfileResolved(true);
          setWakingServer(false);
        }
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
      const body = data.data as AppUserProfile;
      setProfile((prev) => ({ ...prev, ...body }));
      setProfileResolved(true);
      setWakingServer(false);
      writeProfileCache(body);
    } catch (err: unknown) {
      const code = isAxiosLike(err) ? err.response?.data?.code : undefined;
      if (code === "PROFILE_INCOMPLETE") {
        setProfile((prev) => (prev ? { ...prev, is_onboarded: false } : { is_onboarded: false }));
        setProfileResolved(true);
        setWakingServer(false);
      } else {
        const status = isAxiosLike(err) ? err.response?.status : undefined;
        const isTransient = !status || status >= 500 || (isAxiosLike(err) && err.code === "ECONNABORTED");

        if (isTransient) {
          setWakingServer(true);
          try {
            await authAPI.wakeBackend();
            const retry = await authAPI.getMeQuick();
            const body = retry.data.data as AppUserProfile;
            setProfile((prev) => ({ ...prev, ...body }));
            setProfileResolved(true);
            setWakingServer(false);
            writeProfileCache(body);
          } catch {
            const cached = getMatchingCachedProfile(activeSessionUserRef.current);
            setProfile((prev) => prev ?? cached ?? null);
            setProfileResolved(true);
            setWakingServer(false);
          }
        } else {
          const cached = getMatchingCachedProfile(activeSessionUserRef.current);
          setProfile((prev) => prev ?? cached ?? null);
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
      provider: "google",
      options: { redirectTo: getAuthCallbackUrl() },
    });
  }

  async function signInWithEmail(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signUpWithEmail(email: string, password: string, metadata: Record<string, string> = {}) {
    try {
      const response = await authAPI.signup({
        email,
        password,
        phone: metadata.phone || "",
        business_type: metadata.business_type || "solo",
      });

      if (response.data?.user) {
        const { data: sessionData } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        return { data: sessionData, error: null };
      }

      return { data: response.data, error: null };
    } catch (err: unknown) {
      const message = isAxiosLike(err)
        ? String(err.response?.data?.message || err.message || "Signup failed")
        : err instanceof Error
          ? err.message
          : "Signup failed";
      const status = isAxiosLike(err) ? err.response?.status || 500 : 500;
      return { data: null, error: { message, status } };
    }
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
    profileFetchInFlight.current = false;
    await fetchProfile();
  }

  function setProfileWithCache(data: SetStateAction<AppUserProfile | null>) {
    setProfile(data);
    if (data && typeof data !== "function") {
      writeProfileCache(data);
    }
  }

  const isOnboarded = profile?.is_onboarded === true;
  const _rawPlan = profile?.companies?.subscription_plan || "free";
  const _graceUntil = profile?.companies?.subscription_grace_until || null;
  const _subExpiry = profile?.companies?.subscription_expires_at || null;
  const _hardCutoff = _graceUntil || _subExpiry;
  const isPostGrace = _rawPlan !== "free" && _hardCutoff && new Date(_hardCutoff) < new Date();
  const plan = isPostGrace ? "free" : _rawPlan;
  const isInGracePeriod = !!profile?.companies?.is_in_grace_period;
  const graceUntil = _graceUntil;
  const isFree = plan === "free";
  const isBasic = plan === "basic";
  const isPro = ["pro", "elite", "enterprise"].includes(plan);
  const isElite = ["elite", "enterprise"].includes(plan);
  const company = profile?.companies;
  const isPlatformAdmin = profile?.is_platform_admin === true;
  const platformAdminRole = profile?.platform_admin_role || null;

  const verificationStatus = profile?.verification_status || "unverified";
  const isVerified = verificationStatus === "verified";

  const value: AuthContextValue = {
    user,
    profile,
    session,
    loading,
    profileResolved,
    wakingServer,
    isOnboarded,
    plan,
    isPro,
    isElite,
    isBasic,
    isFree,
    isInGracePeriod,
    graceUntil,
    company,
    isPlatformAdmin,
    platformAdminRole,
    verificationStatus,
    isVerified,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    refreshProfile,
    setProfile: setProfileWithCache,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be inside AuthProvider");
  }
  return ctx;
}
