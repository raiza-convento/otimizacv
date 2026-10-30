import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OtimizaCV',
  description: 'Análise inteligente de currículos',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
