const INTERNAL_BASE_URL = "http://nocpulse.local";

export function sanitizeNextPath(value: unknown, fallback = "/") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  try {
    const url = new URL(trimmed, INTERNAL_BASE_URL);

    if (url.origin !== INTERNAL_BASE_URL) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
