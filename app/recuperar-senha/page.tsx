'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const { error: authError } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/redefinir-senha` });
      if (authError) throw authError;
      setMessage('Se existir uma conta para esse e-mail, enviaremos as instruções de recuperação.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível solicitar a recuperação.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-simple-page"><form className="auth-simple-card" onSubmit={submit}><Link href="/login" className="portal-brand"><span className="brand-mark">O</span><span>otimiza<span>cv</span></span></Link><span className="eyebrow">RECUPERAÇÃO DE ACESSO</span><h1>Vamos recuperar sua senha.</h1><p>Informe o e-mail cadastrado para receber o link de redefinição.</p><label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@email.com" /></label>{error && <div className="form-alert error">{error}</div>}{message && <div className="form-alert success">{message}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Enviando...' : 'Enviar link de recuperação'}<span>↗</span></button><Link href="/login" className="back-login">Voltar para o login</Link></form></main>;
}
