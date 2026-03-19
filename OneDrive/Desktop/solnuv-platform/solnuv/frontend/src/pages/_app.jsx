import { AuthProvider } from '../context/AuthContext';
import { Toaster } from 'react-hot-toast';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  const getLayout = Component.getLayout || ((page) => page);
  return (
    <AuthProvider>
      {getLayout(<Component {...pageProps} />)}
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
  );
}
