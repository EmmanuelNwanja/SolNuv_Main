import type { AppProps } from "next/app";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { FloatingThemeToggle } from "../components/ThemeToggle";
import { toast, Toaster, type Toast } from "react-hot-toast";
import ErrorBoundary from "../components/ErrorBoundary";
import UpgradeModal from "../components/UpgradeModal";
import { useEffect } from "react";
import { analyticsAPI } from "../services/api";
import "../styles/globals.css";

let _pvSession: string | null = null;

function getSessionId(): string {
  if (_pvSession) return _pvSession;
  try {
    let sid = sessionStorage.getItem("snuv_sid");
    if (!sid) {
      sid = Math.random().toString(36).slice(2);
      sessionStorage.setItem("snuv_sid", sid);
    }
    _pvSession = sid;
    return sid;
  } catch {
    return "unknown";
  }
}

function trackView(path: string) {
  if (typeof window === "undefined") return;
  void analyticsAPI.trackPageView({ path, session_id: getSessionId() }).catch(() => {});
}

type PageWithLayout = AppProps["Component"] & {
  getLayout?: (page: ReactElement) => ReactNode;
};

function AppShell({ Component, pageProps, router }: AppProps) {
  const Page = Component as PageWithLayout;

  useEffect(() => {
    trackView(router.asPath);
    function onRouteChange(url: string) {
      trackView(url);
    }
    router.events.on("routeChangeComplete", onRouteChange);
    return () => router.events.off("routeChangeComplete", onRouteChange);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const buildVersion = process.env.NEXT_PUBLIC_APP_VERSION || "local";
    const shownVersionKey = "snuv-update-toast-version";
    let hasReloadedForUpdate = false;

    function promptForUpdate(registration: ServiceWorkerRegistration) {
      try {
        if (sessionStorage.getItem(shownVersionKey) === buildVersion) return;
        sessionStorage.setItem(shownVersionKey, buildVersion);
      } catch {
        /* ignore */
      }

      toast((t: Toast) => (
        <div style={{ display: "grid", gap: "8px" }}>
          <strong>New version available</strong>
          <span style={{ fontSize: "13px" }}>Refresh to load the latest fixes and features.</span>
          <button
            type="button"
            onClick={() => {
              const waiting = registration?.waiting;
              if (waiting) {
                waiting.postMessage({ type: "SKIP_WAITING" });
              } else {
                window.location.reload();
              }
              toast.dismiss(t.id);
            }}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "8px 10px",
              background: "#0f766e",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload now
          </button>
        </div>
      ), { duration: 12000, position: "bottom-right" });
    }

    function watchInstallingWorker(worker: ServiceWorker | null, registration: ServiceWorkerRegistration) {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          promptForUpdate(registration);
        }
      });
    }

    function onControllerChange() {
      if (hasReloadedForUpdate) return;
      hasReloadedForUpdate = true;
      window.location.reload();
    }

    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        navigator.serviceWorker
          .register(`/sw.js?v=${encodeURIComponent(buildVersion)}`)
          .then((registration) => {
            if (registration.waiting) {
              promptForUpdate(registration);
            }

            registration.addEventListener("updatefound", () => {
              watchInstallingWorker(registration.installing, registration);
            });

            watchInstallingWorker(registration.installing, registration);
            void registration.update().catch(() => {});
          })
          .catch(() => {});
      } else {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            registrations.forEach((registration) => void registration.unregister().catch(() => {}));
          })
          .catch(() => {});
      }
    }

    const unprotectedPaths = [
      "/",
      "/login",
      "/register",
      "/reset-password",
      "/verify-phone",
      "/onboarding",
      "/auth/callback",
      "/payment/verify",
      "/contact",
      "/blog",
      "/faq",
      "/privacy",
      "/terms",
    ];
    function handleUnauthorized() {
      const pathname = window.location.pathname;
      const isProtected = !unprotectedPaths.some(
        (p) =>
          pathname === p ||
          pathname.startsWith("/field/") ||
          pathname.startsWith("/profile/") ||
          pathname.startsWith("/blog/") ||
          pathname.startsWith("/contact")
      );
      if (isProtected) {
        void router.push("/login");
      }
    }

    window.addEventListener("solnuv:unauthorized", handleUnauthorized);

    // Suppress a burst of rate-limit toasts; show at most once per minute.
    let lastRateLimitAt = 0;
    function handleRateLimited(ev: Event) {
      const now = Date.now();
      if (now - lastRateLimitAt < 60_000) return;
      lastRateLimitAt = now;
      const detail = (ev as CustomEvent<{ retryAfterSeconds: number | null }>).detail;
      const retry = detail?.retryAfterSeconds;
      const wait =
        typeof retry === "number" && retry > 0
          ? `Please retry in ${retry < 60 ? `${retry}s` : `${Math.ceil(retry / 60)}m`}.`
          : "Please slow down and try again in a moment.";
      toast.error(`Too many requests. ${wait}`, { duration: 5000 });
    }
    window.addEventListener("solnuv:rate-limited", handleRateLimited);

    return () => {
      window.removeEventListener("solnuv:unauthorized", handleUnauthorized);
      window.removeEventListener("solnuv:rate-limited", handleRateLimited);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
    };
  }, [router]);

  const getLayout = Page.getLayout || ((page: ReactElement) => page);
  return (
    <div className="app-shell">
      <div className="app-atmo app-atmo-top" />
      <div className="app-atmo app-atmo-bottom" />
      {getLayout(
        <ErrorBoundary>
          <Page {...pageProps} />
        </ErrorBoundary>
      )}
      <UpgradeModal />
      <FloatingThemeToggle />
    </div>
  );
}

export default function App(appProps: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell {...appProps} />
        <Toaster
          position="top-right"
          toastOptions={{
            className: "toast-custom",
            duration: 4000,
            style: { fontFamily: "DM Sans, sans-serif", borderRadius: "12px", fontSize: "14px" },
            success: { iconTheme: { primary: "#10B981", secondary: "#fff" } },
            error: { iconTheme: { primary: "#EF4444", secondary: "#fff" } },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
