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
