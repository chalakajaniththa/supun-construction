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
  experimental: {
    // Document uploads go through the /api rewrite. With a proxy (src/proxy.ts) present, Next
    // buffers request bodies and cuts them at 10 MB by default; the API allows MAX_UPLOAD_MB (50).
    proxyClientMaxBodySize: '60mb',
    // Large uploads / downloads through the rewrite must not time out after 30 s.
    proxyTimeout: 300_000,
  },
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
