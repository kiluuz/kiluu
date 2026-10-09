import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Hide the Next.js dev tools badge (dark "N" circle) — it overlapped the
  // mobile floating dock. It never exists in production builds.
  devIndicators: false,
};

export default nextConfig;
