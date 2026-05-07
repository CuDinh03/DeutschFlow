import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone mode: Docker image nhỏ gọn, Amplify vẫn dùng .next/standalone
  output: 'standalone',

  // ─── Performance ───────────────────────────────────────────────────────────
  // Tắt X-Powered-By header (security + nhỏ hơn response)
  poweredByHeader: false,

  // Compress response (gzip/brotli) — Amplify CloudFront sẽ handle, nhưng fallback
  compress: true,

  // ─── Image optimization ────────────────────────────────────────────────────
  images: {
    // Remote patterns nếu dùng avatar/image từ S3/external
    remotePatterns: [],
    // Serve modern formats (avif > webp > jpg)
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images 1 ngày tối thiểu
    minimumCacheTTL: 86400,
  },

  // ─── HTTP Response Headers (Security + Cache) ──────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Bảo vệ clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Ngăn MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // HTTPS only (Amplify)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Referrer policy
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Static assets: cache 1 năm (Next.js đặt hash trong tên file)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // API routes: không cache
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache' },
        ],
      },
    ];
  },

  // ─── API Proxy (Next.js reverse proxy → Spring Boot) ──────────────────────
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // ─── Experimental ─────────────────────────────────────────────────────────
  experimental: {
    // Tăng tốc React Server Components
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
