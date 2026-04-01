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
 *   --smap-csv <path>   Path to SMAP fixture CSV (optional when AppEEARS creds exist)
 *   --appeears-task-id <id> Resume an existing AppEEARS task (field-id only)
 *   --appeears-poll-seconds <n> Poll interval in seconds (default: 10)
 *   --appeears-task-timeout-minutes <n> Task timeout in minutes (default: 60)
 *   --dry-run           Show what would be fetched without calling APIs
 */

import { writeFile } from "node:fs/promises";
import {
  computeValidationMetrics,
  createAppEearsSmapSource,
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

function utcDayStartIso(d: Date): string {
  return `${isoDate(d)}T00:00:00.000Z`;
}

function addUtcDays(d: Date, days: number): Date {
  const next = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

type BacktestFieldRow = {
  id: string;
  workspace_id: string;
  name: string | null;
  label_point:
    | {
        type?: string;
        coordinates?: unknown;
      }
    | readonly [number, number]
    | null;
};

function toLabelPoint(
  value: BacktestFieldRow["label_point"],
): readonly [number, number] | null {
  if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      return [value[0], value[1]];
    }
    return null;
  }

  const point =
    value && typeof value === "object"
      ? (value as { type?: string; coordinates?: unknown })
      : null;

  if (
    point &&
    point.type === "Point" &&
    Array.isArray(point.coordinates) &&
    point.coordinates.length >= 2 &&
    typeof point.coordinates[0] === "number" &&
    typeof point.coordinates[1] === "number"
  ) {
    return [point.coordinates[0], point.coordinates[1]];
  }

  return null;
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
  const appeearsTaskId = readStringFlag(args, "appeears-task-id");
  const appeearsPollSeconds = readNumberFlag(args, "appeears-poll-seconds");
  const appeearsTaskTimeoutMinutes = readNumberFlag(
    args,
    "appeears-task-timeout-minutes",
  );
  const dryRun = readBooleanFlag(args, "dry-run");

  if (!fieldId && !workspaceId) {
    console.error(
      "[smap-backtest] Either --field-id or --workspace-id is required.",
    );
    process.exitCode = 1;
    return;
  }

  if (appeearsTaskId && !fieldId) {
    console.error(
      "[smap-backtest] --appeears-task-id requires --field-id so the resumed task maps to one field.",
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

  const fieldRows = fields as BacktestFieldRow[];

  console.log(
    `[smap-backtest] found ${fieldRows.length} field(s), period: ${isoDate(startDate)} to ${isoDate(endDate)} (${days} days)`,
  );

  if (dryRun) {
    const summary = {
      mode: "dry-run",
      fields: fieldRows.map((f) => ({
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
    const username = process.env.EARTHDATA_USERNAME;
    const password = process.env.EARTHDATA_PASSWORD;
    const baseUrl = process.env.APPEEARS_BASE_URL;

    if (!username || !password) {
      console.error(
        "[smap-backtest] No --smap-csv provided and AppEEARS credentials are missing. " +
          "Set EARTHDATA_USERNAME / EARTHDATA_PASSWORD or provide --smap-csv <path>.",
      );
      process.exitCode = 1;
      return;
    }

    smapSource = createAppEearsSmapSource(username, password, {
      baseUrl,
      existingTaskId: appeearsTaskId,
      pollIntervalMs:
        appeearsPollSeconds && appeearsPollSeconds > 0
          ? appeearsPollSeconds * 1000
          : undefined,
      taskTimeoutMs:
        appeearsTaskTimeoutMinutes && appeearsTaskTimeoutMinutes > 0
          ? appeearsTaskTimeoutMinutes * 60_000
          : undefined,
      onTaskSubmitted(taskId) {
        console.log(`[smap-backtest] AppEEARS task submitted: ${taskId}`);
      },
      onTaskResumed(taskId) {
        console.log(`[smap-backtest] resuming AppEEARS task: ${taskId}`);
      },
      onProgress(update) {
        const steps = update.steps
          .map((step) =>
            `${step.step ?? "?"}:${step.desc}:${step.pctComplete ?? 0}%`,
          )
          .join(" | ");
        console.log(
          `[smap-backtest] AppEEARS ${update.taskId} ` +
            `${update.taskStatus ?? "unknown"} ` +
            `${update.summaryPct ?? 0}% ` +
            `${update.statusUpdatedAt ?? ""} ` +
            (steps ? `steps=${steps}` : ""),
        );
      },
    });
    console.log(
      `[smap-backtest] using AppEEARS${baseUrl ? ` (${baseUrl})` : ""}`,
    );
  }

  // ---- Process each field ----
  const fieldReports: SmapFieldReport[] = [];

  for (const field of fieldRows) {
    const labelPoint = toLabelPoint(field.label_point);

    if (!labelPoint || labelPoint.length < 2) {
      console.warn(
        `[smap-backtest] field ${field.id} (${field.name}) has no label_point — skipping`,
      );
      continue;
    }

    const [lng, lat] = labelPoint;
    const windowStart = utcDayStartIso(startDate);
    const windowEndExclusive = utcDayStartIso(addUtcDays(endDate, 1));

    // Fetch NocPulse moisture snapshots for this field
    const { data: snapshots, error: snapError } = await db
      .from("field_moisture_snapshots")
      .select("observed_at, root_zone_pct")
      .eq("field_id", field.id)
      .gte("observed_at", windowStart)
      .lt("observed_at", windowEndExclusive)
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
