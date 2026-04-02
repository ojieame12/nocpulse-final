import assert from "node:assert/strict";
import test from "node:test";
import { prepareImportedFieldOnboarding } from "./intakeFieldPreparation";

test("prepareImportedFieldOnboarding upserts crop context before hydration replay", async () => {
  const calls: string[] = [];

  const result = await prepareImportedFieldOnboarding({
    services: {
      fieldCropContext: {
        async upsertFieldContext(input: {
          cropType: string;
          sourceKey: string;
          metadata?: { batchId?: string };
        }) {
          calls.push(`crop:${input.cropType}`);
          assert.equal(input.sourceKey, "field-intake:spreadsheet-commit");
          assert.equal(input.metadata?.batchId, "batch-1");
          return {} as never;
        },
      },
      fieldIntake: {
        async replayFieldHydration(input: {
          fieldName: string;
          cropType?: string;
          legalLandDescriptions: readonly string[];
        }) {
          calls.push(`replay:${input.fieldName}`);
          assert.equal(input.cropType, "canola");
          assert.deepEqual(input.legalLandDescriptions, ["NW-36-042-28-W4"]);
          return {
            action: "replayed",
            sourceFieldId: "source-field-1",
            sourceWorkspaceId: "source-workspace-1",
          };
        },
      },
    } as never,
    payload: {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      fieldName: "Hope Creek North",
      cropType: "canola",
      legalLandDescriptions: ["NW-36-042-28-W4"],
      importBatchId: "batch-1",
      importCandidateId: "candidate-1",
      importSourceType: "spreadsheet",
      importAction: "created",
    },
    requestedAt: "2026-04-02T08:00:00.000Z",
    mode: "bootstrap-initial",
  });

  assert.deepEqual(calls, ["crop:canola", "replay:Hope Creek North"]);
  assert.equal(result.cropContextApplied, true);
  assert.equal(result.replayResult?.action, "replayed");
});

test("prepareImportedFieldOnboarding skips replay for refresh jobs and dry runs", async () => {
  let replayCalls = 0;
  let cropCalls = 0;

  const services = {
    fieldCropContext: {
      async upsertFieldContext(_input: unknown) {
        cropCalls += 1;
        return {} as never;
      },
    },
    fieldIntake: {
      async replayFieldHydration(_input: unknown) {
        replayCalls += 1;
        return {
          action: "skipped",
          reason: "no-source-field",
        } as const;
      },
    },
  } as never;

  const refreshResult = await prepareImportedFieldOnboarding({
    services,
    payload: {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      cropType: "canola",
      legalLandDescriptions: ["NW-36-042-28-W4"],
      importAction: "reused",
    },
    requestedAt: "2026-04-02T08:00:00.000Z",
    mode: "refresh-intake",
  });

  const dryRunResult = await prepareImportedFieldOnboarding({
    services,
    payload: {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      cropType: "canola",
      legalLandDescriptions: ["NW-36-042-28-W4"],
      dryRun: true,
      importAction: "created",
    },
    requestedAt: "2026-04-02T08:00:00.000Z",
    mode: "bootstrap-initial",
  });

  assert.equal(cropCalls, 1);
  assert.equal(replayCalls, 0);
  assert.equal(refreshResult.cropContextApplied, true);
  assert.equal(refreshResult.replayResult, null);
  assert.equal(dryRunResult.cropContextApplied, false);
  assert.equal(dryRunResult.replayResult, null);
});
