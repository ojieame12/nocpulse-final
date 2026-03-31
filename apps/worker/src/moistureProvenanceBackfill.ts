import { createSupabaseFieldRepository } from "@fieldpulse/module-fields";
import { createSupabaseFieldMoistureSnapshotRepository } from "@fieldpulse/module-moisture";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";
import { readRequestedAt } from "./runtime/readRequestedAt";
import { resolveWorkspaceDispatchTargets } from "./runtime/resolveWorkspaceDispatchTargets";

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const dryRun = readBooleanFlag(args, "dry-run");
  const includeMissing = readBooleanFlag(args, "include-missing");
  const force = readBooleanFlag(args, "force");
  const workspaceId = readStringFlag(args, "workspace-id");
  const fieldId = readStringFlag(args, "field-id");
  const limit = readNumberFlag(args, "limit");
  const requestedAt = readRequestedAt(
    readStringFlag(args, "requested-at"),
    "worker-moisture-provenance-backfill",
  );

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (fieldId && !workspaceId) {
    throw new Error(
      "[worker-moisture-provenance-backfill] --field-id requires --workspace-id",
    );
  }

  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });
  const fields = createSupabaseFieldRepository(client);
  const moistureSnapshots = createSupabaseFieldMoistureSnapshotRepository(client);
  const targets = await resolveWorkspaceDispatchTargets({
    runtime,
    workspaceId,
    label: "worker-moisture-provenance-backfill",
  });

  const results: Array<{
    workspaceId: string;
    workspaceSlug: string;
    fieldId: string;
    fieldName: string;
    previousObservedAt: string | null;
    previousDerivationMode: string | null;
    previousSignalBlend: string | null;
    action: "created" | "reused" | "skipped";
    reason: string | null;
    currentObservedAt: string | null;
    currentDerivationMode: string | null;
    currentSignalBlend: string | null;
    currentRasterMode: string | null;
    confidence: string | null;
  }> = [];

  for (const target of targets) {
    const workspaceFields = await fields.listByWorkspace(target.workspaceId);
    const selectedFields = (fieldId
      ? workspaceFields.filter((field) => field.id === fieldId)
      : workspaceFields
    ).slice(0, limit ?? workspaceFields.length);

    for (const field of selectedFields) {
      const latestSnapshot = await moistureSnapshots.getLatestByField(
        target.workspaceId,
        field.id,
      );

      if (!latestSnapshot && !includeMissing) {
        results.push({
          workspaceId: target.workspaceId,
          workspaceSlug: target.workspaceSlug,
          fieldId: field.id,
          fieldName: field.name,
          previousObservedAt: null,
          previousDerivationMode: null,
          previousSignalBlend: null,
          action: "skipped",
          reason: "missing-snapshot",
          currentObservedAt: null,
          currentDerivationMode: null,
          currentSignalBlend: null,
          currentRasterMode: null,
          confidence: null,
        });
        continue;
      }

      if (
        latestSnapshot &&
        latestSnapshot.inputs.derivationMode &&
        !force
      ) {
        results.push({
          workspaceId: target.workspaceId,
          workspaceSlug: target.workspaceSlug,
          fieldId: field.id,
          fieldName: field.name,
          previousObservedAt: latestSnapshot.observedAt,
          previousDerivationMode: latestSnapshot.inputs.derivationMode,
          previousSignalBlend: latestSnapshot.inputs.signalBlend ?? null,
          action: "skipped",
          reason: "already-provenanced",
          currentObservedAt: latestSnapshot.observedAt,
          currentDerivationMode: latestSnapshot.inputs.derivationMode,
          currentSignalBlend: latestSnapshot.inputs.signalBlend ?? null,
          currentRasterMode: latestSnapshot.inputs.rasterMode ?? null,
          confidence: latestSnapshot.confidence,
        });
        continue;
      }

      if (dryRun) {
        results.push({
          workspaceId: target.workspaceId,
          workspaceSlug: target.workspaceSlug,
          fieldId: field.id,
          fieldName: field.name,
          previousObservedAt: latestSnapshot?.observedAt ?? null,
          previousDerivationMode: latestSnapshot?.inputs.derivationMode ?? null,
          previousSignalBlend: latestSnapshot?.inputs.signalBlend ?? null,
          action: "skipped",
          reason: latestSnapshot ? "dry-run-rebuild" : "dry-run-create",
          currentObservedAt: requestedAt,
          currentDerivationMode: null,
          currentSignalBlend: null,
          currentRasterMode: null,
          confidence: null,
        });
        continue;
      }

      const rebuilt = await runtime.services.moisture.rebuildFieldEstimate({
        workspaceId: target.workspaceId,
        fieldId: field.id,
        observedAt: requestedAt,
        inputs: latestSnapshot?.inputs,
      });

      results.push({
        workspaceId: target.workspaceId,
        workspaceSlug: target.workspaceSlug,
        fieldId: field.id,
        fieldName: field.name,
        previousObservedAt: latestSnapshot?.observedAt ?? null,
        previousDerivationMode: latestSnapshot?.inputs.derivationMode ?? null,
        previousSignalBlend: latestSnapshot?.inputs.signalBlend ?? null,
        action: rebuilt.action,
        reason: latestSnapshot ? "provenance-backfill" : "created-current-snapshot",
        currentObservedAt: rebuilt.snapshot.observedAt,
        currentDerivationMode: rebuilt.snapshot.inputs.derivationMode ?? null,
        currentSignalBlend: rebuilt.snapshot.inputs.signalBlend ?? null,
        currentRasterMode: rebuilt.snapshot.inputs.rasterMode ?? null,
        confidence: rebuilt.snapshot.confidence,
      });
    }
  }

  const summary = {
    requestedAt,
    workspaceFilter: workspaceId ?? null,
    fieldFilter: fieldId ?? null,
    scannedCount: results.length,
    rebuiltCount: results.filter((result) => result.action !== "skipped").length,
    skippedCount: results.filter((result) => result.action === "skipped").length,
    dryRunCandidateCount: results.filter(
      (result) =>
        result.reason === "dry-run-rebuild" || result.reason === "dry-run-create",
    ).length,
    missingSnapshotCount: results.filter(
      (result) => result.reason === "missing-snapshot",
    ).length,
    alreadyProvenancedCount: results.filter(
      (result) => result.reason === "already-provenanced",
    ).length,
  };

  if (asJson) {
    console.log(JSON.stringify({ summary, results }, null, 2));
    return;
  }

  console.log(
    [
      `Requested at: ${summary.requestedAt}`,
      `Workspace filter: ${summary.workspaceFilter ?? "all"}`,
      `Field filter: ${summary.fieldFilter ?? "all"}`,
      `Fields scanned: ${summary.scannedCount}`,
      `Rebuilt: ${summary.rebuiltCount}`,
      `Skipped: ${summary.skippedCount}`,
      `Dry-run candidates: ${summary.dryRunCandidateCount}`,
      `Missing snapshot skips: ${summary.missingSnapshotCount}`,
      `Already provenanced skips: ${summary.alreadyProvenancedCount}`,
    ].join("\n"),
  );

  if (results.length === 0) {
    return;
  }

  console.log("\nMoisture provenance backfill");
  console.table(
    results.slice(0, 40).map((result) => ({
      workspace: result.workspaceSlug,
      field: result.fieldName,
      action: result.action,
      reason: result.reason ?? "",
      previousMode: result.previousDerivationMode ?? "",
      currentMode: result.currentDerivationMode ?? "",
      blend: result.currentSignalBlend ?? "",
      rasterMode: result.currentRasterMode ?? "",
      confidence: result.confidence ?? "",
    })),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown moisture provenance backfill failure";
  console.error(`[worker-moisture-provenance-backfill] ${message}`);
  process.exitCode = 1;
});
