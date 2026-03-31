import test from "node:test";
import assert from "node:assert/strict";
import { createSentinelHubImageryProviderClient } from "./createSentinelHubImageryProviderClient";

const boundary = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [-110.5, 52.6],
        [-110.49, 52.6],
        [-110.49, 52.61],
        [-110.5, 52.61],
        [-110.5, 52.6],
      ],
    ],
  ],
} as const;

test("healthcheck retries transient Sentinel Hub token throttling", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  let tokenAttempts = 0;

  globalThis.setTimeout = ((callback: TimerHandler) => {
    if (typeof callback === "function") {
      callback();
    }
    return 0 as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/token")) {
      tokenAttempts += 1;
      if (tokenAttempts === 1) {
        return new Response("throttled", { status: 429 });
      }

      return new Response(JSON.stringify({ access_token: "sentinel-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch in token retry test: ${url}`);
  }) as typeof fetch;

  try {
    const client = createSentinelHubImageryProviderClient({
      provider: "sentinel-1",
      clientId: "client-id",
      clientSecret: "client-secret",
      tokenUrl: "https://example.test/token",
    });

    const healthy = await client.healthcheck();
    assert.equal(healthy, true);
    assert.equal(tokenAttempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("materializeFieldObservation retries throttled statistics requests and succeeds", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  let tokenAttempts = 0;
  let statsAttempts = 0;

  globalThis.setTimeout = ((callback: TimerHandler) => {
    if (typeof callback === "function") {
      callback();
    }
    return 0 as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/token")) {
      tokenAttempts += 1;
      return new Response(JSON.stringify({ access_token: "sentinel-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/statistics")) {
      statsAttempts += 1;

      if (statsAttempts === 1) {
        return new Response("busy", {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }

      return new Response(
        JSON.stringify({
          data: [
            {
              outputs: {
                data: {
                  bands: {
                    sarWetness: { stats: { mean: 0.62, sampleCount: 1 } },
                    sarRatio: { stats: { mean: 0.31, sampleCount: 1 } },
                    vv: { stats: { mean: 0.55, sampleCount: 1 } },
                    vh: { stats: { mean: 0.42, sampleCount: 1 } },
                  },
                },
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    throw new Error(`Unexpected fetch in statistics retry test: ${url}`);
  }) as typeof fetch;

  try {
    const client = createSentinelHubImageryProviderClient({
      provider: "sentinel-1",
      clientId: "client-id",
      clientSecret: "client-secret",
      tokenUrl: "https://example.test/token",
      baseUrl: "https://example.test",
    });

    const result = await client.materializeFieldObservation({
      workspaceId: "workspace-1",
      fieldId: "field-1",
      boundary,
      requestedAt: "2026-03-31T08:00:00.000Z",
      scene: {
        provider: "sentinel-1",
        sceneKey: "scene-1",
        capturedAt: "2026-03-31T06:00:00.000Z",
        coveragePct: 100,
        cloudCoverPct: null,
        note: "test scene",
      },
    });

    assert.ok(result);
    assert.equal(result.metadata?.materializationMode, "provider");
    assert.equal(result.observation.sourceKey, "sentinel-hub-stats-v1:sentinel-1");
    assert.ok(result.observation.cells.length > 0);
    assert.equal(tokenAttempts, 1);
    assert.ok(statsAttempts >= 2);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});
