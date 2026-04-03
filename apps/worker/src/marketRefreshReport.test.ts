import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketRefreshReport,
  describeMarketRefreshReportHealth,
} from "./marketRefreshReport";
import { SUPPORTED_MARKET_CROP_SYMBOLS } from "./marketRefreshQuotes";
import { runMarketCadence } from "./marketCadence";

test("buildMarketRefreshReport defaults to all supported crop symbols and classifies fresh stale and missing quotes", async () => {
  const report = await buildMarketRefreshReport({
    now: "2026-03-28T12:00:00.000Z",
    staleAfterHours: 24,
    async loadLatestPrice(cropSymbol) {
      switch (cropSymbol) {
        case "CANOLA":
          return {
            cropSymbol,
            closePriceCadPerTonne: 720.5,
            basisCadPerTonne: 0,
            sourceCurrency: "CAD",
            sourceUnit: "tonne",
            sourceClosePrice: 720.5,
            fxRateToCad: 1,
            sourceKey: "investing-canada:ice-canola-futures",
            capturedAt: "2026-03-27T18:00:00.000Z",
          };
        case "WHEAT":
          return {
            cropSymbol,
            closePriceCadPerTonne: 308.44,
            basisCadPerTonne: 0,
            sourceCurrency: "USD",
            sourceUnit: "bushel",
            sourceClosePrice: 6.05,
            fxRateToCad: 1.41,
            sourceKey: "manual-admin",
            capturedAt: "2026-03-26T10:00:00.000Z",
          };
        default:
          return null;
      }
    },
  });

  assert.deepEqual(report.cropSymbols, [...SUPPORTED_MARKET_CROP_SYMBOLS]);
  assert.equal(report.healthStatus, "degraded");
  assert.match(report.healthSummary, /1 stale quote/i);
  assert.match(report.healthSummary, /3 missing quotes/i);
  assert.equal(report.freshCount, 1);
  assert.equal(report.staleCount, 1);
  assert.equal(report.missingCount, 3);
  assert.equal(report.errorCount, 0);
  assert.equal(report.entries[0]?.status, "fresh");
  assert.equal(report.entries[1]?.status, "stale");
  assert.equal(report.entries[2]?.status, "missing");
  assert.equal(
    report.entries.find((entry) => entry.cropSymbol === "RYE")?.status,
    "missing",
  );
  assert.match(report.entries[1]?.normalizationLabel ?? "", /USD\/bushel × FX/i);
  assert.equal(report.entries[0]?.errorMessage, null);
});

test("buildMarketRefreshReport keeps investing daily settlements fresh through the next market day", async () => {
  const report = await buildMarketRefreshReport({
    now: "2026-04-03T15:43:22.778Z",
    staleAfterHours: 24,
    async loadLatestPrice(cropSymbol) {
      if (cropSymbol !== "CANOLA") {
        return null;
      }

      return {
        cropSymbol,
        closePriceCadPerTonne: 727.1,
        basisCadPerTonne: 0,
        sourceCurrency: "CAD",
        sourceUnit: "tonne",
        sourceClosePrice: 727.1,
        fxRateToCad: 1,
        sourceKey: "investing-canada:ice-canola-futures",
        capturedAt: "2026-04-02T00:00:00+00:00",
      };
    },
  });

  assert.equal(
    report.entries.find((entry) => entry.cropSymbol === "CANOLA")?.status,
    "fresh",
  );
  assert.equal(report.healthStatus, "degraded");
  assert.match(report.healthSummary, /4 missing quotes/i);
});

test("buildMarketRefreshReport records per-symbol lookup failures without aborting the whole report", async () => {
  const report = await buildMarketRefreshReport({
    now: "2026-03-28T12:00:00.000Z",
    staleAfterHours: 24,
    async loadLatestPrice(cropSymbol) {
      if (cropSymbol === "RYE") {
        throw new Error("snapshot lookup failed");
      }

      return null;
    },
  });

  assert.equal(report.freshCount, 0);
  assert.equal(report.healthStatus, "degraded");
  assert.match(report.healthSummary, /4 missing quotes/i);
  assert.match(report.healthSummary, /1 errored quote/i);
  assert.equal(report.staleCount, 0);
  assert.equal(report.missingCount, 4);
  assert.equal(report.errorCount, 1);
  assert.equal(
    report.entries.find((entry) => entry.cropSymbol === "RYE")?.status,
    "error",
  );
  assert.match(
    report.entries.find((entry) => entry.cropSymbol === "RYE")?.errorMessage ?? "",
    /snapshot lookup failed/i,
  );
});

test("runMarketCadence defaults to all supported crop symbols when none are requested", async () => {
  const enqueueCalls: unknown[] = [];
  const loadCalls: string[] = [];

  const result = await runMarketCadence({
    queue: {
      async enqueue(input) {
        enqueueCalls.push(input);
        return {
          key: input.key,
          payload: input.payload,
          result: {
            id: "scheduled-market-defaults",
            key: input.key,
            status: "queued",
          },
        };
      },
      async drainMatching() {
        return [];
      },
    },
    requestedAt: "2026-03-28T12:00:00.000Z",
    cropSymbols: [],
    dryRun: true,
    drainLimit: 1,
    async loadLatestPrice(cropSymbol) {
      loadCalls.push(cropSymbol);
      return null;
    },
    async sleepFn() {
      return;
    },
  });

  assert.deepEqual(result.cropSymbols, [...SUPPORTED_MARKET_CROP_SYMBOLS]);
  assert.deepEqual(loadCalls, [...SUPPORTED_MARKET_CROP_SYMBOLS]);
  assert.deepEqual(enqueueCalls, [
    {
      key: "market.refresh-prices",
      payload: {
        requestedAt: "2026-03-28T12:00:00.000Z",
        cropSymbols: [...SUPPORTED_MARKET_CROP_SYMBOLS],
        dryRun: true,
      },
    },
  ]);
});

test("describeMarketRefreshReportHealth marks fully fresh coverage as healthy", () => {
  const health = describeMarketRefreshReportHealth({
    cropSymbols: ["CANOLA", "WHEAT"],
    freshCount: 2,
    staleCount: 0,
    missingCount: 0,
    errorCount: 0,
  });

  assert.deepEqual(health, {
    status: "healthy",
    summary: "2 / 2 requested quotes fresh",
  });
});
