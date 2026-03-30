import test from "node:test";
import assert from "node:assert/strict";
import type { JobDispatchResult, PersistentJobDispatchRecord } from "@fieldpulse/platform-jobs";
import {
  MARKET_CADENCE_JOB_KEYS,
  drainScheduledMarketJobs,
  runMarketCadence,
  type MarketCadenceQueue,
} from "./marketCadence";

test("runMarketCadence enqueues market refresh, drains queue, and loads latest snapshots", async () => {
  const enqueueCalls: unknown[] = [];
  const drainCalls: unknown[] = [];
  const loadCalls: string[] = [];

  const scheduledDispatch: PersistentJobDispatchRecord = {
    id: "scheduled-market-1",
    key: "market.refresh-prices",
    status: "queued",
    payload: {},
    attempts: 0,
    availableAt: "2026-03-28T09:55:00.000Z",
    lockedAt: null,
    lockedBy: null,
    attemptStartedAt: null,
    lastHeartbeatAt: null,
    activePhaseKey: null,
    activePhaseLabel: null,
    activePhaseStartedAt: null,
    lastAttemptDurationMs: null,
    progressPct: null,
    progressMessage: null,
    progressUpdatedAt: null,
    cancelRequestedAt: null,
    cancelRequestedBy: null,
    cancelReason: null,
    cancelledAt: null,
    completedAt: null,
    failedAt: null,
    result: null,
    lastError: null,
    createdAt: "2026-03-28T09:55:00.000Z",
    updatedAt: "2026-03-28T09:55:00.000Z",
  };
  const drainedDispatch: JobDispatchResult = {
    key: "market.refresh-prices",
    payload: {},
    result: {
      id: "drained-market-1",
      key: "market.refresh-prices",
      status: "completed",
    },
  };

  const queue: MarketCadenceQueue = {
    async enqueue(input) {
      enqueueCalls.push(input);
      return {
        key: input.key,
        payload: input.payload,
        result: scheduledDispatch,
      };
    },
    async drainMatching(input) {
      drainCalls.push(input);
      return [drainedDispatch];
    },
  };

  const result = await runMarketCadence({
    queue,
    requestedAt: "2026-03-28T09:55:00.000Z",
    cropSymbols: ["canola", "CANOLA"],
    dryRun: false,
    drainLimit: 3,
    async loadLatestPrice(cropSymbol) {
      loadCalls.push(cropSymbol);
      return {
        id: `snapshot-${cropSymbol}`,
        cropSymbol,
        closePriceCadPerTonne: 720.5,
        basisCadPerTonne: 0,
        sourceCurrency: "CAD",
        sourceUnit: "tonne",
        sourceClosePrice: 720.5,
        fxRateToCad: 1,
        sourceKey: "investing-canada:ice-canola-futures",
        capturedAt: "2026-03-27T00:00:00+00:00",
        createdAt: "2026-03-28T09:55:10.000Z",
      };
    },
  });

  assert.deepEqual(enqueueCalls, [
    {
      key: "market.refresh-prices",
      payload: {
        requestedAt: "2026-03-28T09:55:00.000Z",
        cropSymbols: ["CANOLA"],
        dryRun: false,
      },
    },
  ]);
  assert.deepEqual(drainCalls, [
    {
      limit: 3,
      keys: [...MARKET_CADENCE_JOB_KEYS],
    },
  ]);
  assert.deepEqual(loadCalls, ["CANOLA"]);
  assert.equal(result.cropSymbols.length, 1);
  assert.equal(result.scheduledDispatch.id, "scheduled-market-1");
  assert.equal(result.drainedDispatches.length, 1);
  assert.equal(result.latestSnapshots[0]?.snapshot?.closePriceCadPerTonne, 720.5);
});

test("drainScheduledMarketJobs retries once after an empty first drain", async () => {
  const drainCalls: unknown[] = [];
  const sleepCalls: number[] = [];

  const queue: MarketCadenceQueue = {
    async enqueue() {
      throw new Error("enqueue should not be called");
    },
    async drainMatching(input) {
      drainCalls.push(input);
      return drainCalls.length === 1
        ? []
        : [
            {
              key: "market.refresh-prices",
              payload: {},
              result: {
                id: "market-after-retry",
                key: "market.refresh-prices",
                status: "completed",
              },
            },
          ];
    },
  };

  const drained = await drainScheduledMarketJobs({
    queue,
    limit: 2,
    async sleepFn(ms) {
      sleepCalls.push(ms);
    },
  });

  assert.deepEqual(drainCalls, [
    {
      limit: 2,
      keys: [...MARKET_CADENCE_JOB_KEYS],
    },
    {
      limit: 2,
      keys: [...MARKET_CADENCE_JOB_KEYS],
    },
  ]);
  assert.deepEqual(sleepCalls, [350]);
  assert.equal(drained.length, 1);
});

test("runMarketCadence records per-symbol latest snapshot lookup failures without aborting the run", async () => {
  const result = await runMarketCadence({
    queue: {
      async enqueue(input) {
        return {
          key: input.key,
          payload: input.payload,
          result: {
            id: "scheduled-market-errors",
            key: input.key,
            status: "queued",
          },
        };
      },
      async drainMatching() {
        return [];
      },
    },
    requestedAt: "2026-03-28T09:55:00.000Z",
    cropSymbols: ["CANOLA", "RYE"],
    dryRun: true,
    drainLimit: 1,
    async loadLatestPrice(cropSymbol) {
      if (cropSymbol === "RYE") {
        throw new Error("snapshot lookup failed");
      }

      return {
        id: `snapshot-${cropSymbol}`,
        cropSymbol,
        closePriceCadPerTonne: 720.5,
        basisCadPerTonne: 0,
        sourceCurrency: "CAD",
        sourceUnit: "tonne",
        sourceClosePrice: 720.5,
        fxRateToCad: 1,
        sourceKey: "investing-canada:ice-canola-futures",
        capturedAt: "2026-03-27T00:00:00+00:00",
        createdAt: "2026-03-28T09:55:10.000Z",
      };
    },
    async sleepFn() {
      return;
    },
  });

  assert.equal(result.latestSnapshots.length, 2);
  assert.deepEqual(result.latestSnapshots[0], {
    cropSymbol: "CANOLA",
    snapshot: {
      id: "snapshot-CANOLA",
      cropSymbol: "CANOLA",
      closePriceCadPerTonne: 720.5,
      basisCadPerTonne: 0,
      sourceCurrency: "CAD",
      sourceUnit: "tonne",
      sourceClosePrice: 720.5,
      fxRateToCad: 1,
      sourceKey: "investing-canada:ice-canola-futures",
      capturedAt: "2026-03-27T00:00:00+00:00",
      createdAt: "2026-03-28T09:55:10.000Z",
    },
    errorMessage: null,
  });
  assert.equal(result.latestSnapshots[1]?.cropSymbol, "RYE");
  assert.equal(result.latestSnapshots[1]?.snapshot, null);
  assert.match(result.latestSnapshots[1]?.errorMessage ?? "", /snapshot lookup failed/i);
});
