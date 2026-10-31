'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, configError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { if (!loading && user) router.replace('/'); }, [loading, user, router]);

  function destination() {
    const target = new URLSearchParams(window.location.search).get('next');
    return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) return setError('Informe um e-mail válido.');
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (mode === 'register' && name.trim().length < 2) return setError('Informe seu nome.');
    setBusy(true);
    try {
      const client = supabaseBrowser();
      if (mode === 'login') {
        const { error: authError } = await client.auth.signInWithPassword({ email: normalizedEmail, password });
        if (authError) throw authError;
        router.replace(destination());
      } else {
        const { data, error: authError } = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (authError) throw authError;
        if (data.session) router.replace(destination());
        else setMessage('O Supabase criou o cadastro, mas não liberou a sessão. Confira Authentication → Providers → Email e desative Confirm email para permitir acesso sem envio de e-mail.');
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Não foi possível concluir sua solicitação.';
      setError(raw.includes('Invalid login credentials') ? 'E-mail ou senha não conferem.' : raw.includes('User already registered') ? 'Este e-mail já possui cadastro. Entre na sua conta.' : raw);
    } finally { setBusy(false); }
  }

  return <main className="auth-page">
    <section className="auth-brand-panel">
      <Link href="/" className="portal-brand"><span className="brand-mark">O</span><span>otimiza<span>cv</span></span></Link>
      <div className="auth-brand-copy">
        <span className="eyebrow light">CARREIRA, COM MAIS CLAREZA</span>
        <h1>Seu próximo passo profissional começa aqui.</h1>
        <p>Ferramentas inteligentes para transformar currículo, posicionamento e oportunidades em decisões melhores.</p>
        <div className="auth-orbit" aria-hidden="true"><span className="orbit-core">O</span><i className="orbit-dot dot-a"/><i className="orbit-dot dot-b"/><i className="orbit-dot dot-c"/></div>
      </div>
      <span className="auth-panel-foot">OTIMIZACV · INTELIGÊNCIA A FAVOR DA SUA CARREIRA</span>
    </section>
    <section className="auth-form-panel">
      <div className="auth-form-wrap">
        <div className="auth-mobile-brand"><Link href="/" className="portal-brand"><span className="brand-mark">O</span><span>otimiza<span>cv</span></span></Link></div>
        <span className="eyebrow">SEU ESPAÇO DE TRABALHO</span>
        <h2>{mode === 'login' ? 'Bom ter você de volta.' : 'Crie sua conta.'}</h2>
        <p className="auth-intro">{mode === 'login' ? 'Entre para continuar de onde parou.' : 'Um cadastro simples para acessar seus produtos e análises.'}</p>
        {configError && <div className="form-alert error"><strong>Configuração do Supabase necessária</strong><span>{configError}</span></div>}
        <div className="auth-tabs" role="tablist" aria-label="Acesso"><button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Entrar</button><button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); setMessage(''); }}>Criar conta</button></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && <label>Nome completo<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos chamar você?" required /></label>}
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required /></label>
          <label>Senha<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" minLength={8} required /></label>
          {mode === 'login' && <div className="auth-form-meta"><span>Acesso com e-mail e senha. A recuperação automática de senha não está habilitada nesta versão.</span></div>}
          {error && <div className="form-alert error" role="alert">{error}</div>}
          {message && <div className="form-alert success" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy || !!configError}>{busy ? 'Só um instante...' : mode === 'login' ? 'Entrar na minha conta' : 'Criar minha conta'}<span>↗</span></button>
        </form>
        <p className="auth-terms">Seus dados de acesso são utilizados para autenticar sua conta. O envio de currículo possui uma autorização específica na etapa de análise.</p>
      </div>
    </section>
  </main>;
}
