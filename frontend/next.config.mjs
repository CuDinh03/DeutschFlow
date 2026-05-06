import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Dev: proxy về localhost:8080
// Production (Docker): proxy về backend container (http://backend:8080)
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bật standalone mode để Docker image nhỏ gọn (~70% nhỏ hơn)
  // Tạo ra .next/standalone — tự đủ, không cần node_modules đầy đủ khi chạy
  output: 'standalone',

  // API proxy: tránh CORS, Next.js đứng giữa làm reverse proxy
  // Dev: localhost:8080 | Docker: http://backend:8080
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
