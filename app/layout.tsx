import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OtimizaCV',
  description: 'Análise inteligente de currículos',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR">
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=Roboto:wght@400;700&display=swap" rel="stylesheet" />
    </head>
    <body>{children}</body>
  </html>;
}
