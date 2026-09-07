import createNextIntlPlugin from 'next-intl/plugin';
import { legacyV1Redirects } from './legacy-redirects.mjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// ── Static security headers (Amplify web/SSR build) ─────────────────────────────
// The Capacitor static-export build path was retired (AR-M1) — the canonical native
// app is the Expo `mobile/` project. This config now targets only the Amplify SSR
// web build, which handles dynamic routes like /teacher/dashboard/[id] natively.
//
// CSP (P0-7, re-measured 2026-09-07): this static policy is the FLOOR — defense in depth
// for any response that might ever bypass middleware (e.g. future prerendered pages).
// Measured on prod 07/09: every page route currently IS dynamic (src/i18n/request.ts reads
// the locale cookie, which opts the whole tree out of prerendering), middleware runs on all
// of them, and Next stamps its per-request nonce into every <script> tag (35/35 on `/`).
// The old note here claiming "Amplify serves most routes from cache without middleware"
// was verified STALE on that date. The strict nonce-based policy lives in middleware.ts
// (Report-Only today; the enforce flip is a later, gated step — see buildCsp() there).
//
// A build-time header cannot carry a per-request nonce, so script-src here must allow
// 'unsafe-inline'. We allow `https:` for resource loads while still hard-locking the
// high-value injection vectors: default-src 'self', base-uri 'self' (blocks <base>
// hijacking), object-src 'none' (no plugins), frame-ancestors 'none' (anti-clickjacking),
// form-action 'self' (form-action has NO default-src fallback — omitting it lets any
// injected <form> POST credentials anywhere), and no http:. Tightening the `https:`
// blanket to named hosts is planned once the CSP violation collector has real data.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
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
  // microphone=(self): mọi tính năng luyện nói web (exam, AI-speaking, weekly, phoneme…) cần
  // getUserMedia ở chính origin. `microphone=()` (03/06–25/08) đã CHẶN mic toàn site bất kể người
  // dùng cấp quyền gì — Permissions API trả denied vĩnh viễn. Vẫn cấm iframe bên thứ ba (self ≠ *).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()' },
  // COOP/CORP (2026-09-07): audited before adding — every window.open() in src passes
  // 'noopener,noreferrer', there is no OAuth/payment popup flow, and no third party
  // legitimately embeds our resources cross-origin, so same-origin is safe for both.
  // COEP is deliberately NOT set: require-corp would break cross-origin S3/CloudFront
  // media and nothing here needs SharedArrayBuffer.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,

  // Bộ kiểm chữ ký JWT của middleware — NHÚNG LÚC DỰNG, cố ý.
  //
  // Đo 07/09/2026: `process.env.JWT_RSA_PUBLIC_KEY` trong `src/middleware.ts` KHÔNG được Next
  // nhúng sẵn, dù truyền biến qua shell hay qua `.env.production`; gói
  // `.next/server/src/middleware.js` giữ nguyên 3 lượt tra cứu lúc chạy. Trên Amplify, biến của
  // console chỉ sống trong container dựng nên tầng compute không thấy gì → `hasVerifierForV2`
  // false → `passThrough()` → cổng vai trò tầng biên tắt LẶNG với mọi người đã đăng nhập
  // (học viên mở được vỏ `/v2/admin`). Backend `@PreAuthorize` và `RoleAreaGuard` vẫn gác dữ
  // liệu, nhưng lớp biên thì mất.
  //
  // Khai báo ở đây buộc Next thay thế bằng giá trị thật lúc dựng, nên giá trị nằm ngay trong
  // gói middleware — không phụ thuộc việc Amplify có chuyển biến xuống môi trường chạy hay
  // không. `JWT_RSA_PUBLIC_KEY` là khoá CÔNG KHAI và gói này chạy phía máy chủ, không gửi
  // xuống trình duyệt.
  //
  // Giá trị giữ nguyên dạng PEM một dòng với `\n` thoát — middleware tự đổi lại. `?? ''` để
  // build cục bộ không có biến vẫn chạy (cổng vai trò tự tắt đúng như nhánh degrade sẵn có).
  env: {
    JWT_RSA_PUBLIC_KEY: process.env.JWT_RSA_PUBLIC_KEY ?? '',
  },

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
  // `permanent: true` (308) TỪ ĐỢT 3: trước đó là 307 để giữ đường lui khi cây v1 còn nằm trên đĩa.
  // Đợt 3 đã xoá hẳn cây v1 — không còn gì để rollback về — nên các redirect này là vĩnh viễn.
  //
  // Query string được Next giữ nguyên khi redirect (nên `?next=` đi xuyên qua an toàn).
  // trailingSlash: true → khai báo source KHÔNG có dấu "/" cuối; Next tự chuẩn hoá cả hai dạng.
  async redirects() {
    return [
      { source: '/login', destination: '/v2/login', permanent: true },
      { source: '/register', destination: '/v2/register', permanent: true },
      // Dashboard học viên legacy: v2 đã có bản đầy đủ và không nơi nào trong /v2 trỏ ngược về đây.
      { source: '/dashboard', destination: '/v2/student/dashboard', permanent: true },

      // Phần còn lại của cây v1. Từ Đợt 3 các trang đích v1 KHÔNG CÒN TỒN TẠI trên đĩa, nên bảng
      // này là thứ DUY NHẤT giữ cho bookmark/lịch sử/backlink cũ không rơi vào 404 — đừng xoá entry
      // nào khỏi đây kèm theo việc xoá trang.
      // Bảng ánh xạ + danh sách trang CỐ Ý giữ lại: ./legacy-redirects.mjs
      ...legacyV1Redirects,
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
