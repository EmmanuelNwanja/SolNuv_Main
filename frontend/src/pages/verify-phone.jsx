import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function VerifyPhone() {
  const { session, loading, isPlatformAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.replace('/login');
      } else if (isPlatformAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [session, loading, isPlatformAdmin, router]);

  return (
    <div className="auth-shell">
      <div className="auth-wrap">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-forest-900 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    </div>
  );
}
