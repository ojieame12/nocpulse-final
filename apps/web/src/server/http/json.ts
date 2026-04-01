import { logServerError } from "../runtime/installServerCrashLogging";

export function jsonOk(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

export function jsonError(status: number, message: string, details?: unknown) {
  return Response.json(
    {
      error: {
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    {
      status,
    },
  );
}

export async function readJsonObject(request: Request) {
  try {
    const value = await request.json();
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function jsonServerError(
  error: unknown,
  input: {
    message: string;
    status?: number;
    event: string;
    context?: Record<string, unknown>;
  },
) {
  try {
    logServerError(input.event, error, input.context);
  } catch {
    // Logging must never prevent the error response from being sent.
    console.error(`[server][${input.event}] logServerError threw — error suppressed`);
  }

  return jsonError(input.status ?? 500, input.message);
}
