import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile(fileName: string, override = false) {
  let currentDir = process.cwd();

  while (true) {
    const envPath = path.join(currentDir, fileName);

    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf8");

      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (!line || line.startsWith("#")) {
          continue;
        }

        const separatorIndex = line.indexOf("=");

        if (separatorIndex === -1) {
          continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();

        if (!override && process.env[key] !== undefined) {
          continue;
        }

        process.env[key] = value;
      }

      return;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return;
    }

    currentDir = parentDir;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
