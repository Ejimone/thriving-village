import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick a parent-dir lockfile.
  turbopack: {
    root: process.cwd(),
  },
  images: {
    // Grayscale placeholder photography used across the skin.
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
};

export default nextConfig;
