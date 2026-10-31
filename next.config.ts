import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PDFKit carrega as métricas AFM em tempo de execução usando caminhos relativos
  // ao próprio pacote. Evita que o bundler do Next.js altere esses caminhos.
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: {
    '/api/gerar': [
      './node_modules/pdfkit/js/data/**/*',
      './node_modules/pdfkit/js/font/**/*',
    ],
  },
};

export default nextConfig;
