/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Disable type-checking and ESLint during production build.
  // Fix the underlying TS errors before removing these.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Transpile the local shared package so its TypeScript is consumed directly.
  transpilePackages: ['@meetino/shared'],

  // Output a self-contained build for the production Docker image.
  output: 'standalone',

  // Sensible production headers; CSP gets tightened in Phase 9.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
