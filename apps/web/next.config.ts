import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@fieldpulse/map",
    "@fieldpulse/module-fields",
    "@fieldpulse/module-moisture",
    "@fieldpulse/module-workspaces",
    "@fieldpulse/platform-config",
  ],
};

export default nextConfig;
