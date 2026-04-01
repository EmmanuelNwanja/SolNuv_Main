import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { FloatingThemeToggle } from '../components/ThemeToggle';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';

function AppShell({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Service worker is production-only. In development, unregister old workers
    // so stale caches never mask code changes or auth/data bugs.
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
          registration.update().catch(() => {});
        }).catch(() => {});
      } else {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister().catch(() => {}));
        }).catch(() => {});
      }
    }

    // Handle unauthorized events dispatched by the api.js response interceptor.
    // We only redirect to login on truly protected routes, not on public pages.
    const unprotectedPaths = ['/', '/login', '/register', '/reset-password', '/verify-phone',
      '/onboarding', '/auth/callback', '/payment/verify'];
    function handleUnauthorized() {
      const pathname = window.location.pathname;
      const isProtected = !unprotectedPaths.some((p) => pathname === p || pathname.startsWith('/field/') || pathname.startsWith('/profile/'));
      if (isProtected) {
        router.push('/login');
      }
    }

    window.addEventListener('solnuv:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('solnuv:unauthorized', handleUnauthorized);
  }, [router]);

  const getLayout = Component.getLayout || ((page) => page);
  return (
    <div className="app-shell">
      <div className="app-atmo app-atmo-top" />
      <div className="app-atmo app-atmo-bottom" />
      {getLayout(<Component {...pageProps} />)}
      <FloatingThemeToggle />
    </div>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell Component={Component} pageProps={pageProps} />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'toast-custom',
            duration: 4000,
            style: { fontFamily: 'DM Sans, sans-serif', borderRadius: '12px', fontSize: '14px' },
            success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
