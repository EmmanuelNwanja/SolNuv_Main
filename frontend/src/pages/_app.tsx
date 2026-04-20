import type { AppProps } from "next/app";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { FloatingThemeToggle } from "../components/ThemeToggle";
import { toast, Toaster } from "react-hot-toast";
import ErrorBoundary from "../components/ErrorBoundary";
import UpgradeModal from "../components/UpgradeModal";
import { useEffect } from "react";
import { analyticsAPI } from "../services/api";
import "../styles/globals.css";

let _pvSession: string | null = null;

function debugAppLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  fetch("http://127.0.0.1:7567/ingest/e8cc33b1-e17f-4a70-9052-be1634f820ff", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "fbdde2",
    },
    body: JSON.stringify({
      sessionId: "fbdde2",
      runId: "pre-fix",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

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
    let hasReloadedForUpdate = false;
    // #region agent log
    debugAppLog("H1", "_app.tsx:service-worker", "service worker effect start", {
      buildVersion,
      nodeEnv: process.env.NODE_ENV,
      hasServiceWorkerApi: "serviceWorker" in navigator,
      hasController: Boolean(navigator.serviceWorker?.controller),
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    // #endregion

    // Previously we showed a toast asking the user to click "Reload now"
    // before the new SW could take control. Many returning visitors missed
    // it and kept running a stale bundle, which made post-deploy fixes
    // invisible. We now apply updates automatically: as soon as a new
    // worker finishes installing we tell it to skipWaiting, and the
    // controllerchange listener below reloads the tab once the new worker
    // takes control.
    function activateWaitingWorker(registration: ServiceWorkerRegistration) {
      const waiting = registration?.waiting;
      if (!waiting) return;
      // #region agent log
      debugAppLog("H1", "_app.tsx:service-worker", "activating waiting worker", {
        hasWaitingWorker: true,
        scope: registration.scope,
      });
      // #endregion
      try {
        waiting.postMessage({ type: "SKIP_WAITING" });
      } catch {
        /* ignore */
      }
    }

    function watchInstallingWorker(worker: ServiceWorker | null, registration: ServiceWorkerRegistration) {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          activateWaitingWorker(registration);
        }
      });
    }

    function onControllerChange() {
      // #region agent log
      debugAppLog("H1", "_app.tsx:service-worker", "controllerchange fired", {
        hasReloadedForUpdate,
      });
      // #endregion
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
            // #region agent log
            debugAppLog("H1", "_app.tsx:service-worker", "service worker registered", {
              scope: registration.scope,
              hasWaitingWorker: Boolean(registration.waiting),
              hasInstallingWorker: Boolean(registration.installing),
            });
            // #endregion
            if (registration.waiting) {
              activateWaitingWorker(registration);
            }

            registration.addEventListener("updatefound", () => {
              // #region agent log
              debugAppLog("H1", "_app.tsx:service-worker", "service worker updatefound", {
                hasInstallingWorker: Boolean(registration.installing),
              });
              // #endregion
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
      "/pitch",
      "/pitchdeck",
      "/login",
      "/register",
      "/reset-password",
      "/verify-phone",
      "/onboarding",
      "/auth/callback",
      "/payment/verify",
      "/contact",
      "/project-verification",
      "/jobs-opportunities",
      "/pricing",
      "/partners/training",
      "/partners/training/signup",
      "/partners/finance/signup",
      "/partners/recycling/signup",
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
