import { z } from "zod";
import { RequestContextError } from "../runtime/resolveRequestContext";

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function nullableTrimmedString(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalTrimmedString(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumericInput(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? Number(trimmed) : undefined;
  }

  return value;
}

function formatIssuePath(path: (string | number)[]) {
  return path.length > 0 ? path.join(".") : null;
}

export function parseWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(value);

  if (parsed.success) {
    return parsed.data;
  }

  const issue = parsed.error.issues[0];
  const issuePath = issue ? formatIssuePath(issue.path) : null;
  const message = issuePath ? `${issuePath}: ${issue.message}` : issue?.message;

  throw new RequestContextError(
    400,
    message ?? "Request payload is invalid.",
  );
}

export function requiredTrimmedString(message: string) {
  return z.preprocess(
    trimString,
    z.string().min(1, message),
  );
}

export function optionalTrimmedText() {
  return z.preprocess(
    optionalTrimmedString,
    z.string().optional(),
  );
}

export function nullableTrimmedText() {
  return z.preprocess(
    nullableTrimmedString,
    z.string().nullable().optional(),
  );
}

export function finiteNumberInput(message: string) {
  return z.preprocess(
    parseNumericInput,
    z.number().finite(message),
  );
}

export function positiveNumberInput(message: string) {
  return z.preprocess(
    parseNumericInput,
    z.number().positive(message),
  );
}

export function optionalFiniteNumberInput(message: string) {
  return z.preprocess(
    parseNumericInput,
    z.number().finite(message).optional(),
  );
}

export function optionalYearInput(message: string) {
  return z.preprocess(
    parseNumericInput,
    z
      .number()
      .int(message)
      .min(1900, message)
      .max(3000, message)
      .optional(),
  );
}

export { z };
