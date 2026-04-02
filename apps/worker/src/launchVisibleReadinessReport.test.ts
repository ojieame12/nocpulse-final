import test from "node:test";
import assert from "node:assert/strict";
import { buildLaunchVisibleReadinessReport } from "./launchVisibleReadinessReport";
import type { FieldQualityRow } from "./fieldQualityAudit";

function createField(input: Partial<FieldQualityRow> & Pick<FieldQualityRow, "fieldId" | "fieldName">): FieldQualityRow {
  return {
    workspaceId: "8f2afceb-aefe-4e90-a24e-7ab07c4423fe",
    workspaceSlug: "hope-creek",
    workspaceName: "Hope Creek",
    fieldId: input.fieldId,
    fieldName: input.fieldName,
    quality: input.quality ?? "ready",
    reasons: input.reasons ?? [],
    vegetationReadiness: input.vegetationReadiness ?? "ready",
    moistureReadiness: input.moistureReadiness ?? "ready",
    opticalObservationCount: input.opticalObservationCount ?? 3,
    sarObservationCount: input.sarObservationCount ?? 3,
    weatherObservationCount: input.weatherObservationCount ?? 3,
    moistureSnapshotCount: input.moistureSnapshotCount ?? 3,
    sourceBackedMoistureSnapshotCount: input.sourceBackedMoistureSnapshotCount ?? 3,
    latestOpticalObservedAt: input.latestOpticalObservedAt ?? "2026-04-02T00:00:00.000Z",
    latestSarObservedAt: input.latestSarObservedAt ?? "2026-04-02T00:00:00.000Z",
    latestWeatherObservedAt: input.latestWeatherObservedAt ?? "2026-04-02T00:00:00.000Z",
    latestMoistureObservedAt: input.latestMoistureObservedAt ?? "2026-04-02T00:00:00.000Z",
    latestConfidence: input.latestConfidence ?? "high",
    latestSourceKey: input.latestSourceKey ?? "source-backed",
    derivationMode: input.derivationMode ?? "source-backed",
    rasterMode: input.rasterMode ?? "provider",
    signalBlend: input.signalBlend ?? "raster+weather",
    hasSoilContext: input.hasSoilContext ?? true,
    usedOptical: input.usedOptical ?? true,
    usedSar: input.usedSar ?? true,
    usedWeather: input.usedWeather ?? true,
    usedWeatherSoilMoisture: input.usedWeatherSoilMoisture ?? false,
    findings: input.findings ?? 0,
    zones: input.zones ?? 0,
  };
}

test("buildLaunchVisibleReadinessReport scopes Hope Creek to the configured allowlist", () => {
  const report = buildLaunchVisibleReadinessReport({
    workspaceId: "8f2afceb-aefe-4e90-a24e-7ab07c4423fe",
    workspaceSlug: "hope-creek",
    workspaceName: "Hope Creek",
    fields: [
      createField({ fieldId: "f1", fieldName: "Towes", quality: "ready" }),
      createField({ fieldId: "f2", fieldName: "Main Farm", quality: "ready" }),
      createField({ fieldId: "f3", fieldName: "Outside Field", quality: "ready" }),
    ],
  });

  assert.equal(report.allowlistConfigured, true);
  assert.equal(report.scopedFieldCount, 2);
  assert.deepEqual(
    report.rows.map((row) => row.fieldName),
    ["Main Farm", "Towes"],
  );
  assert.equal(report.readyCount, 2);
  assert.equal(report.hasEnoughReadyFields, true);
});

test("buildLaunchVisibleReadinessReport warns when allowlisted workspace lacks enough ready fields", () => {
  const report = buildLaunchVisibleReadinessReport({
    workspaceId: "8f2afceb-aefe-4e90-a24e-7ab07c4423fe",
    workspaceSlug: "hope-creek",
    workspaceName: "Hope Creek",
    fields: [
      createField({ fieldId: "f1", fieldName: "Towes", quality: "ready" }),
      createField({ fieldId: "f2", fieldName: "Main Farm", quality: "thin", reasons: ["vegetation-thin"] }),
    ],
  });

  assert.equal(report.readyCount, 1);
  assert.equal(report.hasEnoughReadyFields, false);
  assert.equal(report.minimumReadyFieldsRequired, 2);
});

test("buildLaunchVisibleReadinessReport falls back to all fields when no allowlist exists", () => {
  const report = buildLaunchVisibleReadinessReport({
    workspaceId: "workspace-2",
    workspaceSlug: "dev-farm",
    workspaceName: "Dev Farm",
    fields: [
      createField({ fieldId: "f1", fieldName: "Field A", quality: "ready", workspaceId: "workspace-2", workspaceSlug: "dev-farm", workspaceName: "Dev Farm" }),
      createField({ fieldId: "f2", fieldName: "Field B", quality: "thin", workspaceId: "workspace-2", workspaceSlug: "dev-farm", workspaceName: "Dev Farm" }),
    ],
  });

  assert.equal(report.allowlistConfigured, false);
  assert.equal(report.scopedFieldCount, 2);
  assert.equal(report.minimumReadyFieldsRequired, 1);
  assert.equal(report.hasEnoughReadyFields, true);
});
