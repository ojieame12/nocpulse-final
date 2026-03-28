import type { ImageryProviderClient } from "./ImageryProviderClient";

type CreateFallbackImageryProviderClientOptions = {
  primary: ImageryProviderClient;
  fallback: ImageryProviderClient;
};

export function createFallbackImageryProviderClient({
  primary,
  fallback,
}: CreateFallbackImageryProviderClientOptions): ImageryProviderClient {
  return {
    provider: primary.provider,
    async healthcheck() {
      try {
        if (await primary.healthcheck()) {
          return true;
        }
      } catch {
        return fallback.healthcheck();
      }

      return fallback.healthcheck();
    },
    async diagnose() {
      const [primaryDiagnostics, fallbackDiagnostics] = await Promise.all([
        primary.diagnose(),
        fallback.diagnose(),
      ]);

      if (
        primaryDiagnostics.status === "ready" ||
        primaryDiagnostics.status === "fallback"
      ) {
        return {
          ...primaryDiagnostics,
          fallbackClient:
            primaryDiagnostics.fallbackClient ?? fallbackDiagnostics.discoveryClient,
        };
      }

      if (fallbackDiagnostics.status !== "unavailable") {
        return {
          provider: primary.provider,
          status: "fallback",
          discoveryMode: fallbackDiagnostics.discoveryMode,
          materializationMode: fallbackDiagnostics.materializationMode,
          discoveryClient: fallbackDiagnostics.discoveryClient,
          materializationClient: fallbackDiagnostics.materializationClient,
          fallbackClient:
            fallbackDiagnostics.discoveryClient ?? fallback.provider,
          reason:
            primaryDiagnostics.reason ??
            fallbackDiagnostics.reason ??
            "Primary provider diagnostics were unavailable.",
          details: {
            primaryStatus: primaryDiagnostics.status,
            fallbackStatus: fallbackDiagnostics.status,
            primaryDiscoveryClient: primaryDiagnostics.discoveryClient,
            fallbackDiscoveryClient: fallbackDiagnostics.discoveryClient,
          },
        };
      }

      return {
        provider: primary.provider,
        status: "unavailable",
        discoveryMode: primaryDiagnostics.discoveryMode,
        materializationMode: primaryDiagnostics.materializationMode,
        discoveryClient: primaryDiagnostics.discoveryClient,
        materializationClient: primaryDiagnostics.materializationClient,
        fallbackClient:
          fallbackDiagnostics.discoveryClient ?? fallback.provider,
        reason:
          primaryDiagnostics.reason ??
          fallbackDiagnostics.reason ??
          "No imagery provider diagnostics are available.",
        details: {
          primaryStatus: primaryDiagnostics.status,
          fallbackStatus: fallbackDiagnostics.status,
        },
      };
    },
    async discoverLatestScene(input) {
      let fallbackReason: string | null = null;

      try {
        const scene = await primary.discoverLatestScene(input);
        if (scene) {
          return scene;
        }
        fallbackReason = "Primary provider returned no discoverable scene.";
      } catch (error) {
        fallbackReason =
          error instanceof Error
            ? error.message
            : "Primary provider discovery failed.";
      }

      const fallbackScene = await fallback.discoverLatestScene(input);

      if (!fallbackScene) {
        return null;
      }

      return {
        ...fallbackScene,
        metadata: {
          ...(fallbackScene.metadata ?? {}),
          discoveryMode:
            fallbackScene.metadata?.discoveryMode ?? "synthetic-fallback",
          discoveryFallbackFrom: primary.provider,
          discoveryFallbackTo: fallback.provider,
          discoveryFallbackReason:
            fallbackReason ??
            fallbackScene.metadata?.discoveryFallbackReason ??
            "Primary provider discovery was unavailable.",
        },
      };
    },
    async materializeFieldObservation(input) {
      let fallbackReason: string | null = null;

      try {
        const observation = await primary.materializeFieldObservation(input);
        if (observation && observation.observation.cells.length > 0) {
          return observation;
        }
        fallbackReason =
          "Primary provider returned no materialized observation cells.";
      } catch (error) {
        fallbackReason =
          error instanceof Error
            ? error.message
            : "Primary provider materialization failed.";
      }

      const fallbackObservation = await fallback.materializeFieldObservation(input);

      if (!fallbackObservation) {
        return null;
      }

      return {
        ...fallbackObservation,
        metadata: {
          ...(fallbackObservation.metadata ?? {}),
          materializationMode:
            fallbackObservation.metadata?.materializationMode ??
            "synthetic-fallback",
          materializationFallbackFrom: primary.provider,
          materializationFallbackTo: fallback.provider,
          materializationFallbackReason:
            fallbackReason ??
            fallbackObservation.metadata?.materializationFallbackReason ??
            "Primary provider materialization was unavailable.",
        },
        note:
          fallbackObservation.note ??
          `Fallback materialization used after ${primary.provider} was unavailable.`,
      };
    },
  };
}
