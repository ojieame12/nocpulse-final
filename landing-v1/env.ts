function resolvePlanetMode(): "off" | "preview" | "full" {
  const hasPlanetKey = Boolean(process.env.PLANET_API_KEY?.trim());
  if (!hasPlanetKey) {
    return "off";
  }

  const mode = process.env.PLANET_MODE?.trim().toLowerCase();
  if (mode === "off" || mode === "preview" || mode === "full") {
    return mode;
  }

  return "full";
}

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL?.trim() ?? "",
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "",
  sentinelLiveTilesEnabled:
    process.env.NEXT_PUBLIC_SENTINEL_LIVE_TILES_ENABLED?.trim() === "true",
  planetApiKey: process.env.PLANET_API_KEY?.trim() ?? "",
  planetClientId: process.env.PLANET_CLIENT_ID?.trim() ?? "",
  planetClientSecret: process.env.PLANET_CLIENT_SECRET?.trim() ?? "",
  planetMode: resolvePlanetMode(),
  townshipGridEnabled:
    process.env.NEXT_PUBLIC_TOWNSHIP_GRID_ENABLED?.trim() === "true",
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL?.trim() || "alerts@fieldpulse.local",
  hasConvex: Boolean(process.env.NEXT_PUBLIC_CONVEX_URL?.trim()),
  hasMapbox: Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim()),
  hasPlanet: resolvePlanetMode() !== "off",
  hasPlanetInsights: Boolean(
    process.env.PLANET_CLIENT_ID?.trim() &&
      process.env.PLANET_CLIENT_SECRET?.trim(),
  ),
};

export const isDemoMode = !env.hasConvex;
