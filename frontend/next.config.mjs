import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Set NEXT_OUTPUT_MODE=export when building for Capacitor (mobile).
// Amplify web builds must NOT set this — without it, Amplify uses SSR mode
// which handles dynamic routes like /teacher/dashboard/[id] natively.
const isMobileBuild = process.env.NEXT_OUTPUT_MODE === 'export';

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
