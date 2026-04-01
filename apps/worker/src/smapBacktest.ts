/**
 * SMAP Backtesting CLI
 *
 * Compares NocPulse moisture estimates against NASA SMAP L4 root-zone
 * soil moisture for model validation.
 *
 * Usage:
 *   node --import tsx src/smapBacktest.ts [options]
 *
 *   --field-id <id>     Single field to test
 *   --workspace-id <id> All fields in workspace
 *   --days <n>          Lookback period (default: 90)
 *   --output <path>     JSON report output (default: stdout)
 *   --smap-csv <path>   Path to SMAP fixture CSV (required until AppEEARS is wired)
 *   --dry-run           Show what would be fetched without calling APIs
 */

import { writeFile } from "node:fs/promises";
import {
  computeValidationMetrics,
  createCsvFixtureSmapSource,
  type SmapDataSource,
  type SmapFieldReport,
  type SmapBacktestReport,
} from "@fieldpulse/module-validation";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();

  const fieldId = readStringFlag(args, "field-id");
  const workspaceId = readStringFlag(args, "workspace-id");
  const days = readNumberFlag(args, "days") ?? 90;
  const outputPath = readStringFlag(args, "output");
  const smapCsvPath = readStringFlag(args, "smap-csv");
  const dryRun = readBooleanFlag(args, "dry-run");

  if (!fieldId && !workspaceId) {
    console.error(
      "[smap-backtest] Either --field-id or --workspace-id is required.",
    );
    process.exitCode = 1;
    return;
  }

  if (runtime.mode !== "supabase") {
    throw new Error("[smap-backtest] Supabase runtime is not configured");
  }

  const db = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });

  // ---- Resolve fields ----
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let fieldsQuery = db
    .from("fields")
    .select("id, workspace_id, name, label_point");

  if (fieldId) {
    fieldsQuery = fieldsQuery.eq("id", fieldId);
  } else if (workspaceId) {
    fieldsQuery = fieldsQuery.eq("workspace_id", workspaceId);
  }

  const { data: fields, error: fieldsError } = await fieldsQuery;

  if (fieldsError) {
    throw new Error(
      `[smap-backtest] failed to load fields: ${fieldsError.message}`,
    );
  }

  if (!fields || fields.length === 0) {
    console.log("[smap-backtest] no fields found matching criteria");
    return;
  }

  console.log(
    `[smap-backtest] found ${fields.length} field(s), period: ${isoDate(startDate)} to ${isoDate(endDate)} (${days} days)`,
  );

  if (dryRun) {
    const summary = {
      mode: "dry-run",
      fields: fields.map((f) => ({
        id: f.id,
        name: f.name,
        labelPoint: f.label_point,
      })),
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      periodDays: days,
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // ---- Resolve SMAP data source ----
  let smapSource: SmapDataSource;

  if (smapCsvPath) {
    smapSource = createCsvFixtureSmapSource(smapCsvPath);
    console.log(`[smap-backtest] using CSV fixture: ${smapCsvPath}`);
  } else {
    // TODO: wire AppEEARS client when credentials are available
    // const username = process.env.EARTHDATA_USERNAME;
    // const password = process.env.EARTHDATA_PASSWORD;
    // smapSource = createAppEearsSmapSource(username, password);
    console.error(
      "[smap-backtest] No --smap-csv provided and AppEEARS is not yet wired. " +
        "Provide a fixture CSV with --smap-csv <path>.",
    );
    process.exitCode = 1;
    return;
  }

  // ---- Process each field ----
  const fieldReports: SmapFieldReport[] = [];

  for (const field of fields) {
    const labelPoint = field.label_point as unknown as
      | readonly [number, number]
      | null;

    if (!labelPoint || labelPoint.length < 2) {
      console.warn(
        `[smap-backtest] field ${field.id} (${field.name}) has no label_point — skipping`,
      );
      continue;
    }

    const [lng, lat] = labelPoint;

    // Fetch NocPulse moisture snapshots for this field
    const { data: snapshots, error: snapError } = await db
      .from("field_moisture_snapshots")
      .select("observed_at, root_zone_pct")
      .eq("field_id", field.id)
      .gte("observed_at", isoDate(startDate))
      .lte("observed_at", isoDate(endDate))
      .order("observed_at", { ascending: true });

    if (snapError) {
      console.warn(
        `[smap-backtest] failed to load snapshots for ${field.id}: ${snapError.message}`,
      );
      continue;
    }

    // Build NocPulse lookup by date
    const nocpulseByDate = new Map<string, number>();
    for (const snap of snapshots ?? []) {
      const date =
        typeof snap.observed_at === "string"
          ? snap.observed_at.slice(0, 10)
          : "";
      const pct =
        typeof snap.root_zone_pct === "number" ? snap.root_zone_pct : NaN;
      if (date && Number.isFinite(pct)) {
        nocpulseByDate.set(date, pct);
      }
    }

    // Fetch SMAP data
    const smapObs = await smapSource.fetchSmapTimeseries(
      lat,
      lng,
      isoDate(startDate),
      isoDate(endDate),
    );

    const smapByDate = new Map<string, number>();
    for (const obs of smapObs) {
      smapByDate.set(obs.date, obs.rootZonePct);
    }

    // Build union timeseries and matched pairs
    const allDates = new Set([
      ...nocpulseByDate.keys(),
      ...smapByDate.keys(),
    ]);
    const sortedDates = [...allDates].sort();

    const timeseries: SmapFieldReport["timeseries"] = [];
    const pairs: Array<{ predicted: number; observed: number }> = [];

    for (const date of sortedDates) {
      const nocpulsePct = nocpulseByDate.get(date) ?? null;
      const smapPct = smapByDate.get(date) ?? null;

      timeseries.push({ date, nocpulsePct, smapPct });

      if (nocpulsePct !== null && smapPct !== null) {
        pairs.push({ predicted: nocpulsePct, observed: smapPct });
      }
    }

    const metrics = computeValidationMetrics(pairs);

    const report: SmapFieldReport = {
      fieldId: field.id,
      fieldName: field.name ?? "Unnamed",
      periodDays: days,
      matchedDates: pairs.length,
      metrics,
      timeseries,
    };

    fieldReports.push(report);

    console.log(
      `[smap-backtest] ${field.name ?? field.id}: ${pairs.length} matched dates, ` +
        `RMSE=${metrics.rmse.toFixed(2)}, MAE=${metrics.mae.toFixed(2)}, ` +
        `r=${metrics.pearsonR.toFixed(3)}, bias=${metrics.bias.toFixed(2)}`,
    );
  }

  // ---- Build summary ----
  const fieldsWithData = fieldReports.filter((r) => r.matchedDates >= 3);

  const backtestReport: SmapBacktestReport = {
    generatedAt: new Date().toISOString(),
    periodDays: days,
    fields: fieldReports,
    summary: {
      totalFields: fieldReports.length,
      fieldsWithData: fieldsWithData.length,
      meanRmse: mean(fieldsWithData.map((r) => r.metrics.rmse)),
      meanMae: mean(fieldsWithData.map((r) => r.metrics.mae)),
      meanPearsonR: mean(fieldsWithData.map((r) => r.metrics.pearsonR)),
      meanBias: mean(fieldsWithData.map((r) => r.metrics.bias)),
    },
  };

  // ---- Output ----
  const json = JSON.stringify(backtestReport, null, 2);

  if (outputPath) {
    await writeFile(outputPath, json, "utf-8");
    console.log(`[smap-backtest] report written to ${outputPath}`);
  } else {
    console.log(json);
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown SMAP backtest failure";
  console.error(`[smap-backtest] ${message}`);
  process.exitCode = 1;
});
