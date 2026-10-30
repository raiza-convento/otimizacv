
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/gerar': [
      './node_modules/pdfkit/js/data/**/*',
      './node_modules/pdfkit/js/font/**/*',
    ],
  },
};

export default nextConfig;
