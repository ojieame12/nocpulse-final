import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let cachedLogoBytes: Uint8Array | null | undefined;

function resolveLogoPath() {
  const candidates = [
    path.resolve(process.cwd(), "public/nocpulse-logo.png"),
    path.resolve(process.cwd(), "apps/web/public/nocpulse-logo.png"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export function loadPdfBrandLogo() {
  if (cachedLogoBytes !== undefined) return cachedLogoBytes;

  const logoPath = resolveLogoPath();
  cachedLogoBytes = logoPath ? new Uint8Array(readFileSync(logoPath)) : null;
  return cachedLogoBytes;
}
