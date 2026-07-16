import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// ── Static security headers (Amplify web/SSR build) ─────────────────────────────
// The Capacitor static-export build path was retired (AR-M1) — the canonical native
// app is the Expo `mobile/` project. This config now targets only the Amplify SSR
// web build, which handles dynamic routes like /teacher/dashboard/[id] natively.
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
  trailingSlash: true,

  // Image optimization stays ON for the Amplify web/SSR build so <Image> is actually optimized. (P1-5)
  images: {
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

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },

  // ── Khai tử bề mặt đăng nhập v1 (đợt 0 của kế hoạch xoá cây v1) ───────────────
  // Vì sao đặt Ở ĐÂY chứ không phải middleware: Amplify phục vụ phần lớn route từ cache CloudFront
  // mà KHÔNG gọi middleware (xem ghi chú CSP phía trên) — mà /login lại đúng là một trang tĩnh được
  // prerender (amplify.yml còn ghi chú sự cố "STALE prerendered /login"). Redirect trong next.config
  // được biên dịch vào routes-manifest và Amplify áp dụng ở tầng CDN, nên nó bắt được cả lượt truy
  // cập từ cache. Middleware vẫn giữ một lớp bounce nữa (defence-in-depth).
  //
  // `permanent: false` (307) là CỐ Ý: 301/308 bị trình duyệt cache vĩnh viễn, nếu phải rollback thì
  // người dùng vẫn kẹt ở redirect cũ. Cây v1 vẫn còn sống nguyên trong đợt này → giữ đường lui.
  // Đến đợt xoá hẳn cây v1 mới nâng lên permanent (kèm bảng redirect đầy đủ).
  //
  // Query string được Next giữ nguyên khi redirect (nên `?next=` đi xuyên qua an toàn).
  // trailingSlash: true → khai báo source KHÔNG có dấu "/" cuối; Next tự chuẩn hoá cả hai dạng.
  async redirects() {
    return [
      { source: '/login', destination: '/v2/login', permanent: false },
      { source: '/register', destination: '/v2/register', permanent: false },
      // Dashboard học viên legacy: v2 đã có bản đầy đủ và không nơi nào trong /v2 trỏ ngược về đây.
      // (Các trang v1 khác — /speaking, /student/mock-exam… — CHƯA được redirect: /v2 vẫn đang
      // deep-link vào chúng vì tính năng chưa port. Chúng chỉ bị xoá/redirect ở đợt sau.)
      { source: '/dashboard', destination: '/v2/student/dashboard', permanent: false },
    ];
  },

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
