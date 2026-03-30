import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __fieldpulseServerCrashLoggingInstalled__: boolean | undefined;
}

function resolveLogFilePath() {
  return (
    process.env.FIELDPULSE_SERVER_LOG_FILE ||
    path.join(process.cwd(), ".next-dev", "fieldpulse-server.log")
  );
}

function writeServerLog(level: "error" | "warn", event: string, payload: Record<string, unknown>) {
  const logPath = resolveLogFilePath();
  mkdirSync(path.dirname(logPath), { recursive: true });
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    pid: process.pid,
    ...payload,
  });
  appendFileSync(logPath, `${line}\n`, "utf8");
}

function serializeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    let json: string | null = null;

    try {
      json = JSON.stringify(record);
    } catch {
      json = null;
    }

    return {
      name:
        typeof record.name === "string"
          ? record.name
          : record.constructor?.name ?? "object",
      message:
        typeof record.message === "string"
          ? record.message
          : json ?? String(error),
      stack: typeof record.stack === "string" ? record.stack : null,
      details: record,
    };
  }

  return {
    name: typeof error,
    message: String(error),
    stack: null,
  };
}

export function logServerError(event: string, error: unknown, context: Record<string, unknown> = {}) {
  const serialized = serializeUnknownError(error);
  console.error(`[server][${event}]`, {
    ...context,
    ...serialized,
  });
  writeServerLog("error", event, {
    ...context,
    ...serialized,
  });
}

export function installServerCrashLogging() {
  if (globalThis.__fieldpulseServerCrashLoggingInstalled__) {
    return;
  }

  globalThis.__fieldpulseServerCrashLoggingInstalled__ = true;

  process.on("uncaughtException", (error) => {
    logServerError("uncaughtException", error);
  });

  process.on("unhandledRejection", (reason) => {
    logServerError("unhandledRejection", reason);
  });

  process.on("warning", (warning) => {
    writeServerLog("warn", "warning", serializeUnknownError(warning));
  });
}
