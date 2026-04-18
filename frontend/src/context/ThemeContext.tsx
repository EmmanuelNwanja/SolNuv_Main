import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

export type ThemeName = "light" | "dark";

export interface ThemePolicy {
  theme_light_enabled: boolean;
  theme_dark_enabled: boolean;
  theme_default: ThemeName;
}

export interface ThemeContextValue {
  theme: ThemeName;
  isDark: boolean;
  setTheme: Dispatch<SetStateAction<ThemeName>>;
  toggleTheme: () => void;
  themePolicy: ThemePolicy;
  canToggleTheme: boolean;
  themePolicyLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DEFAULT_POLICY: ThemePolicy = {
  theme_light_enabled: true,
  theme_dark_enabled: true,
  theme_default: "light",
};

function clampThemeChoice(current: ThemeName, policy: ThemePolicy): ThemeName {
  const lightOk = policy.theme_light_enabled;
  const darkOk = policy.theme_dark_enabled;
  if (lightOk && darkOk) return current;
  if (lightOk && !darkOk) return "light";
  if (!lightOk && darkOk) return "dark";
  return policy.theme_default === "dark" ? "dark" : "light";
}

async function fetchPublicThemePolicy(): Promise<ThemePolicy> {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api) return DEFAULT_POLICY;
  try {
    const res = await fetch(`${api}/api/public/seo`);
    const json = await res.json();
    const d = json?.data;
    if (!d || typeof d !== "object") return DEFAULT_POLICY;
    return {
      theme_light_enabled: d.theme_light_enabled !== false,
      theme_dark_enabled: d.theme_dark_enabled !== false,
      theme_default: d.theme_default === "dark" ? "dark" : "light",
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

function getInitialTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";

  const saved = window.localStorage.getItem("solnuv_theme");
  if (saved === "light" || saved === "dark") return saved;

  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const [themePolicy, setThemePolicy] = useState<ThemePolicy>(DEFAULT_POLICY);
  const [themePolicyLoaded, setThemePolicyLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicThemePolicy().then((policy) => {
      if (cancelled) return;
      setThemePolicy(policy);
      setThemePolicyLoaded(true);
      setTheme((prev) => {
        const next = clampThemeChoice(prev, policy);
        if (typeof window !== "undefined" && next !== prev) {
          window.localStorage.setItem("solnuv_theme", next);
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    window.localStorage.setItem("solnuv_theme", theme);
  }, [theme]);

  const canToggleTheme = themePolicy.theme_light_enabled && themePolicy.theme_dark_enabled;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme: (updater) => {
        setTheme((prev) => {
          const next = typeof updater === "function" ? (updater as (p: ThemeName) => ThemeName)(prev) : updater;
          return clampThemeChoice(next, themePolicy);
        });
      },
      toggleTheme: () => {
        if (!themePolicy.theme_light_enabled || !themePolicy.theme_dark_enabled) return;
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
      },
      themePolicy,
      canToggleTheme,
      themePolicyLoaded,
    }),
    [theme, themePolicy, canToggleTheme, themePolicyLoaded]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
