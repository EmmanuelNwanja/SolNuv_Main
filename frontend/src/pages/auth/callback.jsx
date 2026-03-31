import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabase';
import { authAPI } from '../../services/api';
import { FullPageLoader } from '../../components/ui/index';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function resolveAuthRedirect() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      try {
        const { data } = await authAPI.getMe();
        const profile = data?.data;
        if (!profile?.is_onboarded) {
          const { data: userData } = await supabase.auth.getUser();
          const phoneVerified = !!userData?.user?.user_metadata?.phone_verified;
          router.replace(phoneVerified ? '/onboarding' : '/verify-phone');
          return;
        }

        if (profile?.is_platform_admin) {
          router.replace('/admin');
          return;
        }

        router.replace('/dashboard');
      } catch {
        router.replace('/verify-phone');
      }
    }

    resolveAuthRedirect();
  }, [router]);

  return <FullPageLoader message="Completing sign in..." />;
}