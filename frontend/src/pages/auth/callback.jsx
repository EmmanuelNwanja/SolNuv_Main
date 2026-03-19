import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabase';
import { FullPageLoader } from '../../components/ui/index';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/onboarding');
      else router.replace('/login');
    });
  }, [router]);

  return <FullPageLoader message="Completing sign in..." />;
}
