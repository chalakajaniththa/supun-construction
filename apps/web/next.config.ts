import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Where the Next.js server forwards /api/* (the API is never exposed to the browser).
// Rewrites are resolved at build time, so the Docker build passes API_INTERNAL_URL=http://api:4000.
const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: trace files from the repo root so the standalone output includes workspace packages.
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
  transpilePackages: ['@sc/shared'],
  poweredByHeader: false,
  turbopack: {
    root: new URL('../..', import.meta.url).pathname,
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiInternalUrl}/:path*` }];
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl(nextConfig);
