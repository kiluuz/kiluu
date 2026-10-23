import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Hide the Next.js dev tools badge (dark "N" circle) — it overlapped the
  // mobile floating dock. It never exists in production builds.
  devIndicators: false,

  async headers() {
    return [
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              // Only production assets are content-hashed; avoid stale HMR bundles in development.
              source: "/_next/static/:path*",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ]
        : []),
      {
        source: "/frames/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/api/frames/catalog",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Cache public API responses for 60s at CDN/browser level
        source: "/api/home",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=120",
          },
        ],
      },
      {
        source: "/api/animes",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=30, stale-while-revalidate=60",
          },
        ],
      },
      {
        source: "/api/schedule",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
    ];
  },

  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: "/:path*",
          destination: "/",
        },
      ],
    };
  },
};

export default nextConfig;
