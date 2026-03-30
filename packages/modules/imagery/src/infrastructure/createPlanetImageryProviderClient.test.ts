import test from "node:test";
import assert from "node:assert/strict";
import { createPlanetImageryProviderClient } from "./createPlanetImageryProviderClient";

test("discoverLatestScene does not add a permission filter that hides valid Planet scenes", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: unknown }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url, body });

    return new Response(
      JSON.stringify({
        features: [
          {
            id: "20260328_185823_39_2540",
            properties: {
              acquired: "2026-03-28T18:58:23.396548Z",
              cloud_percent: 12,
              clear_percent: 88,
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const client = createPlanetImageryProviderClient({
      apiKey: "planet-test-key",
    });

    const discovered = await client.discoverLatestScene({
      workspaceId: "workspace-1",
      fieldId: "field-1",
      requestedAt: "2026-03-29T18:23:35.434Z",
      boundary: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-110.5, 52.6],
              [-110.4, 52.6],
              [-110.4, 52.7],
              [-110.5, 52.7],
              [-110.5, 52.6],
            ],
          ],
        ],
      },
    });

    assert.ok(discovered);
    assert.equal(discovered.scene.sceneKey, "20260328_185823_39_2540");
    assert.equal(requests.length, 1);

    const payload = requests[0]?.body as {
      filter?: {
        config?: Array<{ type?: string }>;
      };
    };
    const filterTypes = payload.filter?.config?.map((entry) => entry.type) ?? [];

    assert.ok(filterTypes.includes("GeometryFilter"));
    assert.ok(filterTypes.includes("DateRangeFilter"));
    assert.ok(filterTypes.includes("AssetFilter"));
    assert.equal(filterTypes.includes("PermissionFilter"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
