export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogPayload = Record<string, unknown> | undefined;

export type Logger = {
  debug(event: string, payload?: LogPayload): void;
  info(event: string, payload?: LogPayload): void;
  warn(event: string, payload?: LogPayload): void;
  error(event: string, payload?: LogPayload): void;
};
