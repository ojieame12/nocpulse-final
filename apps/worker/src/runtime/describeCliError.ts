import { inspect } from "node:util";

export function describeCliError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.stack && error.stack.trim().length > 0) {
      return error.stack;
    }

    if (error.message.trim().length > 0) {
      return error.message;
    }
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return inspect(error, {
    depth: 8,
    breakLength: 120,
    compact: false,
  }) || fallback;
}
