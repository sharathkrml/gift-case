import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root; a package-lock.json exists higher up in this folder.
  turbopack: { root: process.cwd() },
  // Keep the demo board unobstructed in development.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Product shots come from the Channel3 CDN.
    remotePatterns: [{ protocol: "https", hostname: "cdn.trychannel3.com" }],
  },
};

export default nextConfig;
