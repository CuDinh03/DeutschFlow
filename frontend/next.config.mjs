import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Set NEXT_OUTPUT_MODE=export when building for Capacitor (mobile).
// Amplify web builds must NOT set this — without it, Amplify uses SSR mode
// which handles dynamic routes like /teacher/dashboard/[id] natively.
const isMobileBuild = process.env.NEXT_OUTPUT_MODE === 'export';

// ── Static security headers (web/SSR build only) ────────────────────────────────
// Static `output: export` (Capacitor) cannot emit HTTP headers, so these apply to the
// Amplify SSR web build.
//
// CSP (P0-7): this is the ENFORCED, production-effective policy. The stricter nonce-based
// CSP lives in middleware.ts, but Amplify serves most routes from the CloudFront cache
// WITHOUT invoking middleware (verified: served HTML carries no per-request nonce and no
// middleware CSP header), so the middleware policy never reaches those users. next.config
// `headers()` IS applied by Amplify at the CDN layer (these other headers prove it), so the
// floor below is what actually protects production on every route.
//
// A static header cannot carry a per-request nonce, so script-src must allow 'unsafe-inline'.
// To stay non-breaking on a revenue app we allow `https:` for resource loads (scripts,
// styles, images, fonts, media, XHR/SSE/WebSocket) while still hard-locking the high-value
// injection vectors: default-src 'self', base-uri 'self' (blocks <base> hijacking),
// object-src 'none' (no plugins), frame-ancestors 'none' (anti-clickjacking), and no http:.
// Follow-up for a strong nonce-based CSP: make middleware actually execute on Amplify, then
// the middleware policy supersedes this floor.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "media-src 'self' blob: data: https:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "frame-src 'self' https:",
  "manifest-src 'self'",
].join('; ');

const securityHeaders = [
  // CSP only in production builds: `next dev` HMR / React Fast Refresh use eval(), which this
  // policy (no 'unsafe-eval') would block. `next build` forces NODE_ENV=production, so Amplify
  // gets the header while local `npm run dev` does not.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }]
    : []),
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

  // Image optimization: OFF only for the static Capacitor export (the Next optimizer needs a server,
  // which `output: 'export'` doesn't have). Amplify web/SSR keeps it ON so <Image> is actually optimized. (P1-5)
  images: {
    ...(isMobileBuild && { unoptimized: true }),
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
