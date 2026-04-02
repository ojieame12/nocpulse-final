import assert from "node:assert/strict";
import test from "node:test";
import { refreshFieldCropStage } from "./refreshFieldCropStage";
import type { FieldCropContext } from "../contracts/FieldCropContext";

const WORKSPACE_ID = "workspace-1";
const FIELD_ID = "field-1";

function createContext(
  overrides: Partial<FieldCropContext> = {},
): FieldCropContext {
  return {
    id: "context-1",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    seasonYear: 2026,
    cropType: "canola",
    growthStage: "vegetative",
    growthStageSource: "derived",
    accumulatedGdd: 12,
    lastGddObservedOn: null,
    lastWeatherSignalSetId: null,
    lastStageUpdatedAt: null,
    sourceKey: "manual-admin",
    metadata: {},
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

test("refreshFieldCropStage preserves legacy incremental accumulation when no seeding date exists", async () => {
  let lastUpsert: FieldCropContext | null = null;
  const current = createContext({
    accumulatedGdd: 12,
    lastGddObservedOn: null,
  });

  const result = await refreshFieldCropStage({
    repository: {
      async getLatestByField() {
        return current;
      },
      async upsertContext(input) {
        lastUpsert = {
          ...current,
          ...input,
          growthStage: input.growthStage ?? null,
          growthStageSource: input.growthStageSource ?? "derived",
          accumulatedGdd: input.accumulatedGdd ?? 0,
          lastGddObservedOn: input.lastGddObservedOn ?? null,
          lastWeatherSignalSetId: input.lastWeatherSignalSetId ?? null,
          lastStageUpdatedAt: input.lastStageUpdatedAt ?? null,
          metadata: input.metadata ?? {},
          updatedAt: "2026-04-03T00:00:00.000Z",
        };
        return lastUpsert;
      },
    },
    input: {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      requestedAt: "2026-05-03T12:00:00.000Z",
      weatherSignalSet: {
        id: "signal-1",
        observedAt: "2026-05-03T12:00:00.000Z",
        gdd24h: 6.25,
      },
      thresholds: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 10 },
        { stage: "flowering", minAccumulatedGdd: 20 },
      ],
    },
  });

  assert.ok(result);
  assert.equal(result.appliedDailyGdd, 6.25);
  assert.equal(result.derivedGrowthStage, "vegetative");
  assert.equal(result.context.accumulatedGdd, 18.25);
  assert.equal(result.context.lastGddObservedOn, "2026-05-03");
  const persistedContext = lastUpsert;
  if (!persistedContext) {
    throw new Error("Expected refreshFieldCropStage to upsert the updated context");
  }
  const updatedContext = persistedContext as FieldCropContext;
  assert.equal(updatedContext.accumulatedGdd, 18.25);
});

test("refreshFieldCropStage recomputes seasonal GDD from seeding date using recent signal history", async () => {
  const current = createContext({
    accumulatedGdd: 999,
    growthStage: "flowering",
    growthStageSource: "manual",
    metadata: {
      seedingDate: "2026-05-02",
    },
  });

  const result = await refreshFieldCropStage({
    repository: {
      async getLatestByField() {
        return current;
      },
      async upsertContext(input) {
        return {
          ...current,
          ...input,
          growthStage: input.growthStage ?? null,
          growthStageSource: input.growthStageSource ?? "derived",
          accumulatedGdd: input.accumulatedGdd ?? 0,
          lastGddObservedOn: input.lastGddObservedOn ?? null,
          lastWeatherSignalSetId: input.lastWeatherSignalSetId ?? null,
          lastStageUpdatedAt: input.lastStageUpdatedAt ?? null,
          metadata: input.metadata ?? {},
          updatedAt: "2026-05-04T00:00:00.000Z",
        };
      },
    },
    input: {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      requestedAt: "2026-05-04T12:00:00.000Z",
      weatherSignalSet: {
        id: "signal-4",
        observedAt: "2026-05-04T12:00:00.000Z",
        gdd24h: 8,
      },
      recentWeatherSignals: [
        {
          observedAt: "2026-05-01T12:00:00.000Z",
          gdd24h: 12,
        },
        {
          observedAt: "2026-05-02T12:00:00.000Z",
          gdd24h: 4,
        },
        {
          observedAt: "2026-05-03T06:00:00.000Z",
          gdd24h: 6,
        },
        {
          observedAt: "2026-05-03T18:00:00.000Z",
          gdd24h: 7,
        },
      ],
      thresholds: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 15 },
        { stage: "flowering", minAccumulatedGdd: 30 },
      ],
    },
  });

  assert.ok(result);
  assert.equal(result.appliedDailyGdd, 8);
  assert.equal(result.context.accumulatedGdd, 19);
  assert.equal(result.derivedGrowthStage, "vegetative");
  assert.equal(result.context.growthStage, "flowering");
  assert.equal(result.context.growthStageSource, "manual");
  assert.equal(result.context.lastGddObservedOn, "2026-05-04");
  assert.deepEqual(result.context.metadata, {
    seedingDate: "2026-05-02",
    lastDerivedGrowthStage: "vegetative",
    seasonAccumulationStartDate: "2026-05-02",
    lastAppliedObservedDay: "2026-05-04",
    lastAppliedDailyGdd: 8,
  });
});

test("refreshFieldCropStage keeps accumulated GDD at zero before the seeding date", async () => {
  const current = createContext({
    accumulatedGdd: 55,
    growthStage: "vegetative",
    growthStageSource: "derived",
    metadata: {
      seedingDate: "2026-05-10",
    },
  });

  const result = await refreshFieldCropStage({
    repository: {
      async getLatestByField() {
        return current;
      },
      async upsertContext(input) {
        return {
          ...current,
          ...input,
          growthStage: input.growthStage ?? null,
          growthStageSource: input.growthStageSource ?? "derived",
          accumulatedGdd: input.accumulatedGdd ?? 0,
          lastGddObservedOn: input.lastGddObservedOn ?? null,
          lastWeatherSignalSetId: input.lastWeatherSignalSetId ?? null,
          lastStageUpdatedAt: input.lastStageUpdatedAt ?? null,
          metadata: input.metadata ?? {},
          updatedAt: "2026-05-04T00:00:00.000Z",
        };
      },
    },
    input: {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      requestedAt: "2026-05-04T12:00:00.000Z",
      weatherSignalSet: {
        id: "signal-4",
        observedAt: "2026-05-04T12:00:00.000Z",
        gdd24h: 8,
      },
      recentWeatherSignals: [
        {
          observedAt: "2026-05-03T12:00:00.000Z",
          gdd24h: 6,
        },
      ],
      thresholds: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 15 },
      ],
    },
  });

  assert.ok(result);
  assert.equal(result.appliedDailyGdd, 0);
  assert.equal(result.context.accumulatedGdd, 0);
  assert.equal(result.derivedGrowthStage, "pre-seed");
  assert.equal(result.context.growthStage, "pre-seed");
  assert.equal(result.context.lastGddObservedOn, null);
});
