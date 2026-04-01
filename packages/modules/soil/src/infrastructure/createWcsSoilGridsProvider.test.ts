import test from "node:test";
import assert from "node:assert/strict";
import { createWcsSoilGridsProvider } from "./createWcsSoilGridsProvider";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Stub setTimeout to make backoff instant during tests. */
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

/**
 * Create a mock GeoTIFF parser that returns the given pixel values.
 * This avoids depending on the real `geotiff` package in tests.
 */
function mockTiffParser(pixels: number[]) {
  return async (_buffer: ArrayBuffer): Promise<number[]> => pixels;
}

/** Build a Response with an ArrayBuffer body (simulating image/tiff). */
function tiffResponse(status = 200): Response {
  // The actual bytes don't matter since we inject a mock parser
  const buffer = new ArrayBuffer(8);
  return new Response(buffer, {
    status,
    headers: { "content-type": "image/tiff" },
  });
}

/** Count how many times fetch was called, grouped by URL substring. */
function createCountingFetch(
  responseFactory: (url: string) => Response = () => tiffResponse(),
) {
  let count = 0;
  const urls: string[] = [];
  const fetchFn = async (
    input: string | URL | Request,
    _init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    urls.push(url);
    count++;
    return responseFactory(url);
  };
  return {
    fetchFn: fetchFn as unknown as typeof globalThis.fetch,
    getCount: () => count,
    getUrls: () => urls,
  };
}

/* ------------------------------------------------------------------ */
/* Tests: GeoTIFF parsing & pixel mean                                 */
/* ------------------------------------------------------------------ */

test("WCS: parses mock GeoTIFF and computes 3x3 pixel mean correctly", async () => {
  // 9 pixels: simulating a 3x3 grid of raw values
  // Raw values in 0.1 vol% (SoilGrids convention)
  const fcPixels = [200, 210, 220, 230, 240, 250, 260, 270, 280]; // mean = 240
  const wpPixels = [100, 110, 120, 130, 140, 150, 160, 170, 180]; // mean = 140

  const { fetchFn } = createCountingFetch();

  let parseCallCount = 0;
  const provider = createWcsSoilGridsProvider({
    fetch: fetchFn,
    parseGeoTiff: async () => {
      parseCallCount++;
      // Alternate between FC and WP pixels based on call order
      // Calls are: wv0033 × 3 depths, then wv1500 × 3 depths
      if (parseCallCount <= 3) return fcPixels;
      return wpPixels;
    },
    maxRetries: 0,
  });

  const result = await provider.query(52.123, -110.456);
  assert.ok(result, "should return a result");
  assert.equal(result.providerPath, "wcs");
  assert.equal(result.samplingMethod, "mean");

  // Each depth should have FC = 240/10 = 24.0 vol%
  assert.equal(result.fc["0-5cm"], 24.0);
  assert.equal(result.fc["5-15cm"], 24.0);
  assert.equal(result.fc["15-30cm"], 24.0);

  // Each depth should have WP = 140/10 = 14.0 vol%
  assert.equal(result.wp["0-5cm"], 14.0);
  assert.equal(result.wp["5-15cm"], 14.0);
  assert.equal(result.wp["15-30cm"], 14.0);

  // Aggregate should be depth-weighted average (all same → same value)
  assert.equal(result.aggregateFcPct, 24.0);
  assert.equal(result.aggregateWpPct, 14.0);

  // pixelCount = 9 pixels × 6 requests = 54
  assert.equal(result.pixelCount, 54);
});

test("WCS: computes depth-weighted average with varying per-depth values", async () => {
  // Different raw values per depth
  const depthValues: Record<string, { fc: number[]; wp: number[] }> = {
    "0-5cm": { fc: [100], wp: [50] }, // fc=10.0, wp=5.0
    "5-15cm": { fc: [200], wp: [100] }, // fc=20.0, wp=10.0
    "15-30cm": { fc: [300], wp: [150] }, // fc=30.0, wp=15.0
  };

  const depths = ["0-5cm", "5-15cm", "15-30cm"];
  let callIndex = 0;

  const provider = createWcsSoilGridsProvider({
    fetch: (async () => tiffResponse()) as unknown as typeof globalThis.fetch,
    parseGeoTiff: async () => {
      // Calls alternate: wv0033_0-5, wv0033_5-15, wv0033_15-30,
      //                  wv1500_0-5, wv1500_5-15, wv1500_15-30
      const depthIdx = callIndex % 3;
      const isWp = callIndex >= 3;
      callIndex++;
      const depth = depths[depthIdx];
      return isWp
        ? depthValues[depth].wp
        : depthValues[depth].fc;
    },
    maxRetries: 0,
  });

  const result = await provider.query(52.0, -110.0);
  assert.ok(result);

  assert.equal(result.fc["0-5cm"], 10.0);
  assert.equal(result.fc["5-15cm"], 20.0);
  assert.equal(result.fc["15-30cm"], 30.0);

  // Depth-weighted: (10*5 + 20*10 + 30*15) / (5+10+15) = (50+200+450)/30 = 700/30 ≈ 23.333
  assert.ok(result.aggregateFcPct != null);
  assert.ok(
    Math.abs(result.aggregateFcPct! - 23.333) < 0.01,
    `expected ~23.333, got ${result.aggregateFcPct}`,
  );

  // WP: (5*5 + 10*10 + 15*15) / 30 = (25+100+225)/30 = 350/30 ≈ 11.667
  assert.ok(result.aggregateWpPct != null);
  assert.ok(
    Math.abs(result.aggregateWpPct! - 11.667) < 0.01,
    `expected ~11.667, got ${result.aggregateWpPct}`,
  );
});

/* ------------------------------------------------------------------ */
/* Tests: partial depth failures                                       */
/* ------------------------------------------------------------------ */

test("WCS: handles partial depth failures (some null)", async () => {
  const restore = patchTimers();
  let callIndex = 0;

  const provider = createWcsSoilGridsProvider({
    fetch: (async (_url: string) => {
      const url = typeof _url === "string" ? _url : "";
      callIndex++;
      // Fail 5-15cm requests (index 1 and 4 in the 6-request sequence)
      if (url.includes("5-15cm")) {
        return new Response("server error", { status: 500 });
      }
      return tiffResponse();
    }) as unknown as typeof globalThis.fetch,
    parseGeoTiff: mockTiffParser([200, 210, 220]), // mean raw = 210
    maxRetries: 0,
  });

  try {
    const result = await provider.query(52.0, -110.0);
    assert.ok(result, "should return partial results");
    assert.equal(result.fc["0-5cm"], 21.0);
    assert.equal(result.fc["5-15cm"], null);
    assert.equal(result.fc["15-30cm"], 21.0);
    assert.equal(result.wp["0-5cm"], 21.0);
    assert.equal(result.wp["5-15cm"], null);
    assert.equal(result.wp["15-30cm"], 21.0);

    // Aggregate should skip the missing 5-15cm depth
    // Weighted: (21*5 + 21*15) / (5+15) = (105+315)/20 = 21.0
    assert.equal(result.aggregateFcPct, 21.0);
    assert.equal(result.aggregateWpPct, 21.0);
  } finally {
    restore();
  }
});

/* ------------------------------------------------------------------ */
/* Tests: retries on 429/5xx                                           */
/* ------------------------------------------------------------------ */

test("WCS: retries on 429 then succeeds", async () => {
  const restore = patchTimers();
  const attemptsByUrl = new Map<string, number>();

  const provider = createWcsSoilGridsProvider({
    fetch: (async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      const attempts = (attemptsByUrl.get(url) ?? 0) + 1;
      attemptsByUrl.set(url, attempts);
      // Fail first attempt, succeed on retry
      if (attempts === 1) {
        return new Response("rate limited", { status: 429 });
      }
      return tiffResponse();
    }) as unknown as typeof globalThis.fetch,
    parseGeoTiff: mockTiffParser([200]),
    maxRetries: 2,
  });

  try {
    const result = await provider.query(52.0, -110.0);
    assert.ok(result, "should succeed after retry");
    // All depths should have values
    assert.equal(result.fc["0-5cm"], 20.0);
  } finally {
    restore();
  }
});

test("WCS: returns null on total failure (all retries exhausted)", async () => {
  const restore = patchTimers();

  const provider = createWcsSoilGridsProvider({
    fetch: (async () =>
      new Response("server error", { status: 500 })) as unknown as typeof globalThis.fetch,
    parseGeoTiff: mockTiffParser([200]),
    maxRetries: 1,
  });

  try {
    const result = await provider.query(52.0, -110.0);
    assert.equal(result, null, "should return null on total failure");
  } finally {
    restore();
  }
});

/* ------------------------------------------------------------------ */
/* Tests: coordinate rounding cache                                    */
/* ------------------------------------------------------------------ */

test("WCS: coordinate rounding produces cache hits", async () => {
  const { fetchFn, getCount } = createCountingFetch();

  const provider = createWcsSoilGridsProvider({
    fetch: fetchFn,
    parseGeoTiff: mockTiffParser([200]),
    maxRetries: 0,
  });

  // 52.1231 rounds to 52.123, 52.1234 rounds to 52.123
  await provider.query(52.1231, -110.4564);
  const firstCount = getCount();

  await provider.query(52.1234, -110.4561);
  assert.equal(
    getCount(),
    firstCount,
    "second query should hit cache (no additional fetches)",
  );
  assert.equal(provider.getCacheSize(), 1);
});

test("WCS: different rounded coordinates produce separate fetches", async () => {
  const { fetchFn, getCount } = createCountingFetch();

  const provider = createWcsSoilGridsProvider({
    fetch: fetchFn,
    parseGeoTiff: mockTiffParser([200]),
    maxRetries: 0,
  });

  await provider.query(52.123, -110.456);
  const firstCount = getCount();

  await provider.query(52.124, -110.456);
  assert.ok(getCount() > firstCount, "should make new fetches for different coords");
  assert.equal(provider.getCacheSize(), 2);
});

/* ------------------------------------------------------------------ */
/* Tests: nodata handling                                              */
/* ------------------------------------------------------------------ */

test("WCS: filters nodata pixels from mean calculation", async () => {
  // Mix of valid and nodata pixels (-32769 is below threshold)
  const pixels = [200, -32769, 220, -99999, 240];
  // Valid: 200, 220, 240 → mean = 220

  const provider = createWcsSoilGridsProvider({
    fetch: (async () => tiffResponse()) as unknown as typeof globalThis.fetch,
    parseGeoTiff: mockTiffParser(pixels),
    maxRetries: 0,
  });

  const result = await provider.query(52.0, -110.0);
  assert.ok(result);
  // 220 / 10 = 22.0
  assert.equal(result.fc["0-5cm"], 22.0);
});

test("WCS: returns null when all pixels are nodata", async () => {
  const restore = patchTimers();
  const pixels = [-32769, -99999, -32769];

  const provider = createWcsSoilGridsProvider({
    fetch: (async () => tiffResponse()) as unknown as typeof globalThis.fetch,
    parseGeoTiff: mockTiffParser(pixels),
    maxRetries: 0,
  });

  try {
    const result = await provider.query(52.0, -110.0);
    assert.equal(result, null, "should return null when all pixels are nodata");
  } finally {
    restore();
  }
});

/* ------------------------------------------------------------------ */
/* Tests: URL construction                                             */
/* ------------------------------------------------------------------ */

test("WCS: constructs correct ISRIC WCS URLs", async () => {
  const { fetchFn, getUrls } = createCountingFetch();

  const provider = createWcsSoilGridsProvider({
    fetch: fetchFn,
    parseGeoTiff: mockTiffParser([200]),
    maxRetries: 0,
  });

  await provider.query(52.123, -110.456);
  const urls = getUrls();

  // Should have 6 requests: 2 properties × 3 depths
  assert.equal(urls.length, 6);

  // Check first URL (wv0033, 0-5cm)
  const first = urls[0];
  assert.ok(first.includes("map=/map/wv0033.map"), "should target wv0033 map");
  assert.ok(first.includes("COVERAGEID=wv0033_0-5cm_mean"), "should have correct coverage ID");
  assert.ok(first.includes("FORMAT=image/tiff"), "should request GeoTIFF");
  assert.ok(first.includes("SUBSET=long("), "should have longitude subset");
  assert.ok(first.includes("SUBSET=lat("), "should have latitude subset");
});
