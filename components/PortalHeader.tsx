'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

const items = [
  { href: '/produtos/otimiza-cv', label: 'Otimiza CV', code: '01' },
  { href: '/produtos/analise-linkedin', label: 'Análise LinkedIn', code: '02' },
  { href: '/produtos/comparativo-vaga-cv', label: 'Comparativo Vaga x CV', code: '03' },
];

export default function PortalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const fullName = String(user?.user_metadata?.full_name || user?.email || 'Minha conta');
  const firstName = fullName.split(' ')[0].split('@')[0];
  async function exit() {
    if (leaving) return;
    setLeaving(true);
    await signOut();
    router.replace('/login');
  }
  return <header className="portal-header">
    <Link href="/" className="portal-brand" aria-label="OtimizaCV, página inicial"><span className="brand-mark">O</span><span>otimiza<span>cv</span></span></Link>
    <button type="button" className="mobile-menu-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>Produtos <span>⌄</span></button>
    <nav className={`product-nav ${menuOpen ? 'open' : ''}`} aria-label="Produtos">
      {items.map((item) => <Link key={item.href} href={item.href} className={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : ''} onClick={() => setMenuOpen(false)}><small>{item.code}</small>{item.label}</Link>)}
    </nav>
    <div className="account-menu">
      <span className="account-avatar">{firstName.slice(0, 1).toUpperCase()}</span>
      <span className="account-name">{firstName}</span>
      <button type="button" onClick={() => void exit()} disabled={leaving} className="logout-button">{leaving ? 'Saindo...' : 'Sair'}</button>
    </div>
  </header>;
}
