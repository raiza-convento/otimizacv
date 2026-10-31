'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, configError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user && !configError) router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
  }, [loading, user, configError, router, pathname]);
  if (loading) return <div className="auth-loading"><span className="brand-mark">O</span><p>Preparando seu espaço...</p></div>;
  if (configError) return <div className="auth-loading"><div className="auth-error"><strong>Configuração necessária</strong><p>{configError}</p><small>Confira as variáveis públicas do Supabase no ambiente da Vercel.</small></div></div>;
  if (!user) return <div className="auth-loading"><span className="brand-mark">O</span><p>Redirecionando para o login...</p></div>;
  return <>{children}</>;
}
