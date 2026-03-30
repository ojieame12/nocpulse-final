import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";

const nextConfig: NextConfig = {
  distDir,
  reactStrictMode: true,
  experimental: {
    clientSegmentCache: false,
    devtoolSegmentExplorer: false,
  },
  transpilePackages: [
    "@fieldpulse/map",
    "@fieldpulse/module-fields",
    "@fieldpulse/module-moisture",
    "@fieldpulse/module-workspaces",
    "@fieldpulse/platform-config",
  ],
};

export default nextConfig;
