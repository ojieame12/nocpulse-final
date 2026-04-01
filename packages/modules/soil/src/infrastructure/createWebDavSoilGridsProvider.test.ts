import test from "node:test";
import assert from "node:assert/strict";
import {
  createWebDavSoilGridsProvider,
  type PointSampler,
} from "./createWebDavSoilGridsProvider";

/* ------------------------------------------------------------------ */
/* Fixtures                                                           */
/* ------------------------------------------------------------------ */

/** Dummy TIFF buffer — the mock sampler ignores its contents. */
const DUMMY_TIFF = new ArrayBuffer(64);

/**
 * Mock sampler that returns predictable raw values based on coordinates.
 * Returns null for a specific "out of bounds" sentinel latitude.
 */
const OUT_OF_BOUNDS_LAT = 99.0;

const mockSampler: PointSampler = (
  _tiffBuffer: ArrayBuffer,
  lat: number,
  _lng: number,
): number | null => {
  if (lat === OUT_OF_BOUNDS_LAT) return null;
  // Return a predictable raw value derived from the lat.
  // wv0033 and wv1500 both use the same sampler, so we use lat to differentiate.
  return Math.round(lat * 10);
};

/** Track fetch calls for assertions. */
type FetchCall = {
  url: string;
  init?: RequestInit;
  timestamp: number;
};

function createMockFetch(options?: {
  failUrls?: Set<string>;
}): {
  fetch: typeof globalThis.fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const failUrls = options?.failUrls ?? new Set();

  const fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init, timestamp: Date.now() });

    if (failUrls.has(url)) {
      return new Response("Internal Server Error", { status: 500 });
    }

    return new Response(DUMMY_TIFF, {
      status: 200,
      headers: { "content-type": "image/tiff" },
    });
  };

  return { fetch: fetch as typeof globalThis.fetch, calls };
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

test("bulk query with 3 points returns results for all 3", async () => {
  const { fetch } = createMockFetch();
  const provider = createWebDavSoilGridsProvider({
    fetch,
    pointSampler: mockSampler,
    downloadDelayMs: 0,
  });

  const points = [
    { fieldId: "field-1", lat: 52.0, lng: -110.0 },
    { fieldId: "field-2", lat: 48.5, lng: -105.0 },
    { fieldId: "field-3", lat: 45.0, lng: -100.0 },
  ];

  const results = await provider.queryBulk(points);

  assert.equal(results.length, 3);

  // field-1: raw = round(52.0 * 10) = 520, divided by 10 = 52.0
  assert.equal(results[0]!.fieldId, "field-1");
  assert.ok(results[0]!.properties);
  assert.equal(results[0]!.properties!.fieldCapacityPct, 52.0);
  assert.equal(results[0]!.properties!.wiltingPointPct, 52.0);
  assert.equal(results[0]!.properties!.depthCm, "0-30cm");
  assert.equal(results[0]!.properties!.source, "soilgrids-v2");

  // field-2: raw = round(48.5 * 10) = 485, / 10 = 48.5
  assert.equal(results[1]!.fieldId, "field-2");
  assert.ok(results[1]!.properties);
  assert.equal(results[1]!.properties!.fieldCapacityPct, 48.5);

  // field-3: raw = round(45.0 * 10) = 450, / 10 = 45.0
  assert.equal(results[2]!.fieldId, "field-3");
  assert.ok(results[2]!.properties);
  assert.equal(results[2]!.properties!.fieldCapacityPct, 45.0);
});

test("null result for point outside tile bounds", async () => {
  const { fetch } = createMockFetch();
  const provider = createWebDavSoilGridsProvider({
    fetch,
    pointSampler: mockSampler,
    downloadDelayMs: 0,
  });

  const points = [
    { fieldId: "in-bounds", lat: 52.0, lng: -110.0 },
    { fieldId: "out-of-bounds", lat: OUT_OF_BOUNDS_LAT, lng: -110.0 },
    { fieldId: "also-in-bounds", lat: 48.0, lng: -105.0 },
  ];

  const results = await provider.queryBulk(points);

  assert.equal(results.length, 3);
  assert.ok(results[0]!.properties, "in-bounds should have properties");
  assert.equal(
    results[1]!.properties,
    null,
    "out-of-bounds should be null",
  );
  assert.ok(results[2]!.properties, "also-in-bounds should have properties");
});

test("rate limiting: delay between downloads", async () => {
  const { fetch, calls } = createMockFetch();
  const delayMs = 50; // Short delay for test speed

  const provider = createWebDavSoilGridsProvider({
    fetch,
    pointSampler: mockSampler,
    downloadDelayMs: delayMs,
  });

  const points = [{ fieldId: "field-1", lat: 52.0, lng: -110.0 }];
  await provider.queryBulk(points);

  // Should have 2 fetch calls (wv0033 and wv1500)
  assert.equal(calls.length, 2);

  // Second call should be at least delayMs after the first
  const elapsed = calls[1]!.timestamp - calls[0]!.timestamp;
  assert.ok(
    elapsed >= delayMs - 5, // small tolerance for timer imprecision
    `Expected at least ${delayMs}ms between downloads, got ${elapsed}ms`,
  );
});

test("auth header is set correctly", async () => {
  const { fetch, calls } = createMockFetch();
  const provider = createWebDavSoilGridsProvider({
    fetch,
    pointSampler: mockSampler,
    downloadDelayMs: 0,
  });

  await provider.queryBulk([{ fieldId: "f1", lat: 52.0, lng: -110.0 }]);

  assert.ok(calls.length > 0, "should have made at least one fetch call");

  const expectedAuth = `Basic ${btoa("anonymous:anonymous")}`;
  for (const call of calls) {
    const headers = call.init?.headers as Record<string, string> | undefined;
    assert.ok(headers, "fetch call should include headers");
    assert.equal(
      headers!.Authorization,
      expectedAuth,
      "Authorization header should use anonymous:anonymous Basic auth",
    );
  }
});

test("handles download failure gracefully — null for affected fields", async () => {
  // Fail the wv0033 tile download
  const wv0033Url =
    "https://files.isric.org/soilgrids/latest/data/wv0033/0-30cm/mean.vrt";
  const { fetch } = createMockFetch({ failUrls: new Set([wv0033Url]) });

  const provider = createWebDavSoilGridsProvider({
    fetch,
    pointSampler: mockSampler,
    downloadDelayMs: 0,
  });

  const results = await provider.queryBulk([
    { fieldId: "field-1", lat: 52.0, lng: -110.0 },
    { fieldId: "field-2", lat: 48.0, lng: -105.0 },
  ]);

  assert.equal(results.length, 2);
  assert.equal(
    results[0]!.properties,
    null,
    "should be null when tile download fails",
  );
  assert.equal(
    results[1]!.properties,
    null,
    "should be null when tile download fails",
  );
});

test("empty points array returns empty results", async () => {
  const { fetch, calls } = createMockFetch();
  const provider = createWebDavSoilGridsProvider({
    fetch,
    pointSampler: mockSampler,
    downloadDelayMs: 0,
  });

  const results = await provider.queryBulk([]);

  assert.equal(results.length, 0);
  assert.equal(calls.length, 0, "should not make any fetch calls");
});

test("fetch URLs target correct SoilGrids WebDAV paths", async () => {
  const { fetch, calls } = createMockFetch();
  const provider = createWebDavSoilGridsProvider({
    fetch,
    pointSampler: mockSampler,
    downloadDelayMs: 0,
  });

  await provider.queryBulk([{ fieldId: "f1", lat: 52.0, lng: -110.0 }]);

  assert.equal(calls.length, 2);
  assert.ok(calls[0]!.url.includes("/wv0033/0-30cm/mean.vrt"));
  assert.ok(calls[1]!.url.includes("/wv1500/0-30cm/mean.vrt"));
});

test("custom baseUrl is respected", async () => {
  const { fetch, calls } = createMockFetch();
  const provider = createWebDavSoilGridsProvider({
    baseUrl: "https://custom.example.com/data",
    fetch,
    pointSampler: mockSampler,
    downloadDelayMs: 0,
  });

  await provider.queryBulk([{ fieldId: "f1", lat: 52.0, lng: -110.0 }]);

  assert.ok(calls[0]!.url.startsWith("https://custom.example.com/data/"));
});
