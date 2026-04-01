import test from "node:test";
import assert from "node:assert/strict";
import { createSoilGridsClient } from "./SoilGridsClient";

/* ------------------------------------------------------------------ */
/* Fixtures                                                           */
/* ------------------------------------------------------------------ */

const VALID_RESPONSE = {
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

test("parses valid API response correctly", async () => {
  const client = createSoilGridsClient({
    fetch: async () => jsonResponse(VALID_RESPONSE),
  });

  const result = await client.query(52.123, -110.456);
  assert.ok(result);
  assert.equal(result.fieldCapacityPct, 23.4);
  assert.equal(result.wiltingPointPct, 12.3);
  assert.equal(result.depthCm, "0-30cm");
  assert.equal(result.source, "soilgrids-v2");
});

test("returns null on 429 after retries exhausted", async () => {
  // Speed up test: bypass real timers
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((cb: TimerHandler) => {
    if (typeof cb === "function") cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;

  let attempts = 0;
  const client = createSoilGridsClient({
    maxRetries: 2,
    fetch: async () => {
      attempts++;
      return new Response("rate limited", { status: 429 });
    },
  });

  try {
    const result = await client.query(52.0, -110.0);
    assert.equal(result, null);
    // 1 initial + 2 retries = 3 total
    assert.equal(attempts, 3);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("returns null on 503 after retries exhausted", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((cb: TimerHandler) => {
    if (typeof cb === "function") cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;

  const client = createSoilGridsClient({
    maxRetries: 1,
    fetch: async () => new Response("service unavailable", { status: 503 }),
  });

  try {
    const result = await client.query(52.0, -110.0);
    assert.equal(result, null);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("returns null on timeout (abort)", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((cb: TimerHandler) => {
    if (typeof cb === "function") cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;

  const client = createSoilGridsClient({
    timeoutMs: 1,
    maxRetries: 0,
    fetch: async (_url, init) => {
      // Simulate a fetch that respects the abort signal
      if (init?.signal?.aborted) {
        throw new DOMException("The operation was aborted", "AbortError");
      }
      // Simulate slow response — signal will have been aborted by the 1ms timer
      throw new DOMException("The operation was aborted", "AbortError");
    },
  });

  try {
    const result = await client.query(52.0, -110.0);
    assert.equal(result, null);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("coordinate rounding produces cache hits for nearby points", async () => {
  let fetchCount = 0;
  const client = createSoilGridsClient({
    fetch: async () => {
      fetchCount++;
      return jsonResponse(VALID_RESPONSE);
    },
  });

  // These two coordinates round to the same 3-decimal value:
  // 52.1234 -> 52.123, 52.1236 -> 52.124  (different!)
  // 52.1231 -> 52.123, 52.1234 -> 52.123  (same!)
  await client.query(52.1231, -110.4564);
  await client.query(52.1234, -110.4561);

  assert.equal(fetchCount, 1, "second query should hit cache");
  assert.equal(client.getCacheSize(), 1);
});

test("different coordinates after rounding produce separate fetches", async () => {
  let fetchCount = 0;
  const client = createSoilGridsClient({
    fetch: async () => {
      fetchCount++;
      return jsonResponse(VALID_RESPONSE);
    },
  });

  await client.query(52.123, -110.456);
  await client.query(52.124, -110.456);

  assert.equal(fetchCount, 2, "different rounded coords should fetch separately");
  assert.equal(client.getCacheSize(), 2);
});

test("returns null on malformed response body", async () => {
  const client = createSoilGridsClient({
    fetch: async () => jsonResponse({ properties: { layers: [] } }),
  });

  const result = await client.query(52.0, -110.0);
  assert.equal(result, null);
});

test("returns null on non-retryable 404", async () => {
  let attempts = 0;
  const client = createSoilGridsClient({
    fetch: async () => {
      attempts++;
      return new Response("not found", { status: 404 });
    },
  });

  const result = await client.query(52.0, -110.0);
  assert.equal(result, null);
  assert.equal(attempts, 1, "should not retry on 404");
});
