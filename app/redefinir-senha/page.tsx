'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não são iguais.');
    setBusy(true);
    try {
      const { error: authError } = await supabaseBrowser().auth.updateUser({ password });
      if (authError) throw authError;
      router.replace('/');
    } catch (e) { setError(e instanceof Error ? e.message : 'O link pode ter expirado. Solicite outro.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-simple-page"><form className="auth-simple-card" onSubmit={submit}><Link href="/login" className="portal-brand"><span className="brand-mark">O</span><span>otimiza<span>cv</span></span></Link><span className="eyebrow">NOVA SENHA</span><h1>Defina uma nova senha.</h1><label>Nova senha<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label><label>Confirme a senha<input type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label>{error && <div className="form-alert error">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'}<span>↗</span></button></form></main>;
}
