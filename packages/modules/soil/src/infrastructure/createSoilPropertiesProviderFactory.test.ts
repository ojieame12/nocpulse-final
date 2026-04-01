import test from "node:test";
import assert from "node:assert/strict";
import { createSoilPropertiesProvider } from "./createSoilPropertiesProviderFactory";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function patchTimers() {
  const original = globalThis.setTimeout;
  globalThis.setTimeout = ((cb: TimerHandler) => {
    if (typeof cb === "function") cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;
  return () => {
    globalThis.setTimeout = original;
  };
}

function tiffResponse(): Response {
  return new Response(new ArrayBuffer(8), {
    status: 200,
    headers: { "content-type": "image/tiff" },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const VALID_REST_RESPONSE = {
  properties: {
    layers: [
      {
        name: "wv0033",
        depths: [{ label: "0-30cm", values: { mean: 234 } }],
      },
      {
        name: "wv1500",
        depths: [{ label: "0-30cm", values: { mean: 123 } }],
      },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test("Factory: uses WCS as primary provider", async () => {
  let wcsHit = false;

  const provider = createSoilPropertiesProvider({
    fetch: (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("maps.isric.org")) {
        wcsHit = true;
        return tiffResponse();
      }
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof globalThis.fetch,
    wcsOptions: {
      parseGeoTiff: async () => [200, 210, 220],
      maxRetries: 0,
    },
  });

  const result = await provider.query(52.0, -110.0);
  assert.ok(result);
  assert.equal(result.providerPath, "wcs");
  assert.ok(wcsHit, "should have hit WCS");
});

test("Factory: falls back to REST when WCS fails and fallback enabled", async () => {
  const restore = patchTimers();

  const provider = createSoilPropertiesProvider({
    enableRestFallback: true,
    fetch: (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      // WCS always fails
      if (url.includes("maps.isric.org") || url.includes("mapserv")) {
        return new Response("error", { status: 500 });
      }
      // REST succeeds
      if (url.includes("rest.isric.org")) {
        return jsonResponse(VALID_REST_RESPONSE);
      }
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof globalThis.fetch,
    wcsOptions: {
      parseGeoTiff: async () => [200],
      maxRetries: 0,
    },
    restOptions: {
      maxRetries: 0,
    },
  });

  try {
    const result = await provider.query(52.0, -110.0);
    assert.ok(result, "should return REST fallback result");
    assert.equal(result.providerPath, "rest");
    assert.equal(result.aggregateFcPct, 23.4);
    assert.equal(result.aggregateWpPct, 12.3);
    assert.equal(result.fc["0-30cm"], 23.4);
    assert.equal(result.wp["0-30cm"], 12.3);
  } finally {
    restore();
  }
});

test("Factory: returns null when WCS fails and fallback disabled", async () => {
  const restore = patchTimers();

  const provider = createSoilPropertiesProvider({
    enableRestFallback: false,
    fetch: (async () =>
      new Response("error", { status: 500 })) as unknown as typeof globalThis.fetch,
    wcsOptions: {
      parseGeoTiff: async () => [200],
      maxRetries: 0,
    },
  });

  try {
    const result = await provider.query(52.0, -110.0);
    assert.equal(result, null);
  } finally {
    restore();
  }
});

test("Factory: does not call REST when WCS succeeds", async () => {
  let restHit = false;

  const provider = createSoilPropertiesProvider({
    enableRestFallback: true,
    fetch: (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("rest.isric.org")) {
        restHit = true;
        return jsonResponse(VALID_REST_RESPONSE);
      }
      return tiffResponse();
    }) as unknown as typeof globalThis.fetch,
    wcsOptions: {
      parseGeoTiff: async () => [200],
      maxRetries: 0,
    },
  });

  const result = await provider.query(52.0, -110.0);
  assert.ok(result);
  assert.equal(result.providerPath, "wcs");
  assert.ok(!restHit, "should NOT have called REST when WCS succeeded");
});
