import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Set NEXT_OUTPUT_MODE=export when building for Capacitor (mobile).
// Amplify web builds must NOT set this — without it, Amplify uses SSR mode
// which handles dynamic routes like /teacher/dashboard/[id] natively.
const isMobileBuild = process.env.NEXT_OUTPUT_MODE === 'export';

// ── Security headers (web/SSR build only) ───────────────────────────────────────
// Static `output: export` (Capacitor) cannot emit HTTP headers, so these apply to the
// Amplify SSR web build. CSP ships as Report-Only first to avoid breaking prod; tighten
// to a nonce-based enforced policy once reports are clean (see docs/SECURITY_ANALYSIS.md S17).
const backendOrigin = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/api\/?$/, '');
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
const cloudfront = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || '';

const connectSrc = ["'self'", backendOrigin, posthogHost, cloudfront, 'https:']
  .filter(Boolean)
  .join(' ');

const contentSecurityPolicy = [
  "default-src 'self'",
  // TODO(S17): replace 'unsafe-inline'/'unsafe-eval' with per-request nonces, then enforce.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${posthogHost}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src ${connectSrc}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
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
