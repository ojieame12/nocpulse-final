import test from "node:test";
import assert from "node:assert/strict";
import { buildLaunchVisibleFollowupReport } from "./launchVisibleFollowupReport";

test("buildLaunchVisibleFollowupReport summarizes missing ready fields and blockers", () => {
  const report = buildLaunchVisibleFollowupReport({
    readiness: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      workspaceId: "w1",
      workspaceSlug: "hope-creek",
      workspaceName: "Hope Creek",
      allowlistConfigured: true,
      allowlistFieldCount: 2,
      scopedFieldCount: 2,
      readyCount: 0,
      thinCount: 2,
      fallbackCount: 0,
      brokenCount: 0,
      readyShare: 0,
      hasEnoughReadyFields: false,
      minimumReadyFieldsRequired: 2,
      rows: [
        {
          fieldId: "f1",
          fieldName: "Field One",
          quality: "thin",
          reasons: ["vegetation-empty", "moisture-history-thin"],
          vegetationReadiness: "empty",
          moistureReadiness: "thin",
          latestConfidence: "high",
          derivationMode: "source-backed",
          rasterMode: "provider",
          signalBlend: "raster+weather",
          latestMoistureObservedAt: "2026-04-02T10:00:00.000Z",
          allowlisted: true,
          allowlistRank: 0,
        },
        {
          fieldId: "f2",
          fieldName: "Field Two",
          quality: "thin",
          reasons: ["vegetation-thin"],
          vegetationReadiness: "thin",
          moistureReadiness: "ready",
          latestConfidence: "high",
          derivationMode: "source-backed",
          rasterMode: "provider",
          signalBlend: "raster+weather",
          latestMoistureObservedAt: "2026-04-02T10:00:00.000Z",
          allowlisted: true,
          allowlistRank: 1,
        },
      ],
    },
  });

  assert.equal(report.missingReadyFieldCount, 2);
  assert.deepEqual(
    report.topBlockers.map((blocker) => blocker.reason),
    ["moisture-history-thin", "vegetation-empty", "vegetation-thin"],
  );
  assert.equal(report.rows[0]?.nextAction, "Wait for a usable clear optical capture before using this field in launch-visible summaries.");
  assert.equal(report.nextAction, "Promote or replace at least 2 launch-visible field(s) before outreach.");
});

test("buildLaunchVisibleFollowupReport marks ready scoped sets as good enough", () => {
  const report = buildLaunchVisibleFollowupReport({
    readiness: {
      generatedAt: "2026-04-02T12:00:00.000Z",
      workspaceId: "w1",
      workspaceSlug: "hope-creek",
      workspaceName: "Hope Creek",
      allowlistConfigured: false,
      allowlistFieldCount: 0,
      scopedFieldCount: 1,
      readyCount: 1,
      thinCount: 0,
      fallbackCount: 0,
      brokenCount: 0,
      readyShare: 1,
      hasEnoughReadyFields: true,
      minimumReadyFieldsRequired: 1,
      rows: [
        {
          fieldId: "f1",
          fieldName: "Field One",
          quality: "ready",
          reasons: [],
          vegetationReadiness: "ready",
          moistureReadiness: "ready",
          latestConfidence: "high",
          derivationMode: "source-backed",
          rasterMode: "provider",
          signalBlend: "raster+weather",
          latestMoistureObservedAt: "2026-04-02T10:00:00.000Z",
          allowlisted: false,
          allowlistRank: null,
        },
      ],
    },
  });

  assert.equal(report.missingReadyFieldCount, 0);
  assert.equal(report.weakFieldCount, 0);
  assert.equal(report.nextAction, "Launch-visible field set is strong enough; keep monitoring weak fields outside the ready set.");
  assert.equal(report.rows[0]?.nextAction, "Keep this field in the launch-visible set.");
});
