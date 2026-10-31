'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase-browser';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configError: string;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const client = supabaseBrowser();
      client.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error) setConfigError(error.message);
        else setConfigError('');
        setSession(data.session);
        setUser(data.session?.user || null);
        setLoading(false);
      }).catch((error: unknown) => {
        if (active) {
          setConfigError(error instanceof Error ? error.message : 'Não foi possível verificar sua sessão.');
          setLoading(false);
        }
      });
      const listener = client.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setConfigError('');
        setSession(nextSession);
        setUser(nextSession?.user || null);
        setLoading(false);
      });
      subscription = listener.data.subscription;
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Configuração do Supabase ausente.');
      setLoading(false);
    }
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);

  const signOut = useCallback(async () => {
    try { await supabaseBrowser().auth.signOut(); }
    finally { setSession(null); setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, session, loading, configError, signOut }), [user, session, loading, configError, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
