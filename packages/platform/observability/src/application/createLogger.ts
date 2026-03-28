import type { LogLevel, LogPayload, Logger } from "../contracts/Logger";

function emit(level: LogLevel, scope: string, event: string, payload?: LogPayload) {
  const entry = {
    level,
    scope,
    event,
    payload,
    at: new Date().toISOString(),
  };

  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

export function createLogger(scope: string): Logger {
  return {
    debug(event: string, payload?: LogPayload) {
      emit("debug", scope, event, payload);
    },
    info(event: string, payload?: LogPayload) {
      emit("info", scope, event, payload);
    },
    warn(event: string, payload?: LogPayload) {
      emit("warn", scope, event, payload);
    },
    error(event: string, payload?: LogPayload) {
      emit("error", scope, event, payload);
    },
  };
}
