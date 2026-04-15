import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabase';
import toast from 'react-hot-toast';
import { FullPageLoader } from '../../components/ui/index';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function resolveAuthRedirect() {
      if (!router.isReady) return;

      const authError = router.query.error_description || router.query.error;
      if (authError) {
        toast.error(String(authError));
        router.replace('/login');
        return;
      }

      let { data: { session } } = await supabase.auth.getSession();

      // On OAuth return, session exchange may not be complete yet. If a code is present,
      // exchange it explicitly before deciding the user is unauthenticated.
      if (!session && typeof window !== 'undefined') {
        const authCode = new URL(window.location.href).searchParams.get('code');
        if (authCode) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
          if (!exchangeError) {
            session = exchangeData?.session || null;
          }
        }
      }

      if (!session) {
        router.replace('/login');
        return;
      }

      // Session exists: hand off post-login route decision to centralized auth state guards.
      router.replace('/login?post_auth=1');
    }

    resolveAuthRedirect();
  }, [router, router.isReady, router.query.error, router.query.error_description]);

  return <FullPageLoader message="Completing sign in..." />;
}