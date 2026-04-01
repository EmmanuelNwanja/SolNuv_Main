import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { FloatingThemeToggle } from '../components/ThemeToggle';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const getLayout = Component.getLayout || ((page) => page);
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="app-shell">
          {getLayout(<Component {...pageProps} />)}
          <FloatingThemeToggle />
        </div>
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
