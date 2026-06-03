import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Set NEXT_OUTPUT_MODE=export when building for Capacitor (mobile).
// Amplify web builds must NOT set this — without it, Amplify uses SSR mode
// which handles dynamic routes like /teacher/dashboard/[id] natively.
const isMobileBuild = process.env.NEXT_OUTPUT_MODE === 'export';

// ── Static security headers (web/SSR build only) ────────────────────────────────
// Static `output: export` (Capacitor) cannot emit HTTP headers, so these apply to the
// Amplify SSR web build. CSP is intentionally NOT here — it needs a per-request nonce and
// is set in middleware.ts (Report-Only; flip to enforced once reports are clean — S17).
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isMobileBuild && { output: 'export' }),
  trailingSlash: true,

  // Image optimization disabled for static/mobile export; fine to keep for web too
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'deutschflow-media-storage.s3.ap-southeast-1.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'deutschflow-media-storage.s3.amazonaws.com',
        pathname: '/**',
      },
    ],
  },

  // HTTP security headers — skipped for the static Capacitor export (unsupported there).
  ...(isMobileBuild
    ? {}
    : {
        async headers() {
          return [{ source: '/:path*', headers: securityHeaders }];
        },
      }),

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      'recharts',
    ],
  },
};

export default withNextIntl(nextConfig);
