import {
  createFallbackImageryProviderClient,
  createPlanetImageryProviderClient,
  createSentinelHubImageryProviderClient,
  createSyntheticImageryProviderClient,
  type ImageryProviderClient,
} from "@fieldpulse/module-imagery";
import type { RuntimeEnv } from "../contracts/ServerRuntime";

export function createDefaultImageryProviderClients(
  env: RuntimeEnv,
): readonly ImageryProviderClient[] {
  return [
    env.imagery.sentinelHub.enabled &&
    env.imagery.sentinelHub.clientId &&
    env.imagery.sentinelHub.clientSecret
      ? createFallbackImageryProviderClient({
          primary: createSentinelHubImageryProviderClient({
            provider: "sentinel-2",
            clientId: env.imagery.sentinelHub.clientId,
            clientSecret: env.imagery.sentinelHub.clientSecret,
          }),
          fallback: createSyntheticImageryProviderClient({
            provider: "sentinel-2",
            activationReason:
              "Sentinel Hub credentials failed or provider access was unavailable; synthetic sentinel-2 fallback is active.",
          }),
        })
      : createSyntheticImageryProviderClient({
        provider: "sentinel-2",
        activationReason:
          "Sentinel Hub credentials are not configured; synthetic sentinel-2 client is active.",
      }),
    env.imagery.planet.enabled && env.imagery.planet.apiKey
      ? createFallbackImageryProviderClient({
          primary: createPlanetImageryProviderClient({
            apiKey: env.imagery.planet.apiKey,
          }),
          fallback: createSyntheticImageryProviderClient({
            provider: "planet",
            activationReason:
              "Planet credentials failed or provider access was unavailable; synthetic planet fallback is active.",
          }),
        })
      : createSyntheticImageryProviderClient({
        provider: "planet",
        activationReason:
          "Planet credentials are not configured; synthetic planet client is active.",
      }),
    env.imagery.sentinelHub.enabled &&
    env.imagery.sentinelHub.clientId &&
    env.imagery.sentinelHub.clientSecret
      ? createFallbackImageryProviderClient({
          primary: createSentinelHubImageryProviderClient({
            provider: "sentinel-1",
            clientId: env.imagery.sentinelHub.clientId,
            clientSecret: env.imagery.sentinelHub.clientSecret,
          }),
          fallback: createSyntheticImageryProviderClient({
            provider: "sentinel-1",
            activationReason:
              "Sentinel Hub credentials failed or provider access was unavailable; synthetic sentinel-1 fallback is active.",
          }),
        })
      : createSyntheticImageryProviderClient({
        provider: "sentinel-1",
        activationReason:
          "Sentinel Hub credentials are not configured; synthetic sentinel-1 client is active.",
      }),
  ] as const;
}
