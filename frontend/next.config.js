/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,                    // gzip/brotli at the Next.js layer
  poweredByHeader: false,            // hide X-Powered-By
  productionBrowserSourceMaps: false, // smaller JS bundles in prod
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local',
  },

  images: {
    formats: ['image/avif', 'image/webp'], // serve AVIF first, WebP fallback
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  async rewrites() {
    return [
      // Browsers always probe /favicon.ico regardless of <link> tags — serve the SVG
      { source: '/favicon.ico', destination: '/favicon.svg' },
    ];
  },

  async headers() {
    return [
      // ── Service worker should always be fetched fresh so update checks work reliably ──
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
        ],
      },
      // ── Static assets (JS/CSS chunks hashed by Next.js — safe to cache forever) ──
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // ── Public font files ──
      {
        source: '/fonts/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // ── Next.js route data must revalidate to avoid stale post-deploy payloads ──
      {
        source: '/_next/data/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      // ── HTML/navigation responses should revalidate on each visit ──
      {
        source: '/((?!_next/static|_next/data|fonts|icons|manifest.json|sw.js|favicon.ico|favicon.svg).*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      // ── All pages — security headers ──
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://js.paystack.co",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paystack.co https://solnuv-backend.onrender.com https://api.solnuv.com https://cloudflareinsights.com",
              "frame-src https://checkout.paystack.com https://js.paystack.co",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
