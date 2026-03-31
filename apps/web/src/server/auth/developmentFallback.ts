export const DEVELOPMENT_FALLBACK_COOKIE_NAME = "fieldpulse-dev-auth";
export const DEVELOPMENT_FALLBACK_HEADER = "x-fieldpulse-dev-auth";
export const FALLBACK_ACTOR_USER_ID =
  "00000000-0000-4000-8000-000000000001";

const DEVELOPMENT_FALLBACK_PURPOSE = "fieldpulse:development-fallback";
const encoder = new TextEncoder();

function parseRequestHost(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.split(",")[0]?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.includes("://") ? trimmed : `http://${trimmed}`;

  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLoopbackHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  );
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function parseCookieHeader(header: string) {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex === -1) {
        return null;
      }

      return {
        name: entry.slice(0, separatorIndex),
        value: entry.slice(separatorIndex + 1),
      };
    })
    .filter((entry): entry is { name: string; value: string } => entry !== null);
}

function readDevelopmentFallbackToken(request: Pick<Request, "headers">) {
  const headerToken =
    request.headers.get(DEVELOPMENT_FALLBACK_HEADER)?.trim() ?? "";

  if (headerToken) {
    return headerToken;
  }

  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookie = parseCookieHeader(cookieHeader).find(
    (entry) => entry.name === DEVELOPMENT_FALLBACK_COOKIE_NAME,
  );

  return cookie?.value?.trim() || null;
}

export function resolveDevelopmentFallbackActorUserId(input: {
  devActorUserId?: string | null;
}) {
  return input.devActorUserId?.trim() || FALLBACK_ACTOR_USER_ID;
}

export function isDevelopmentFallbackRequestAllowed(input: {
  nodeEnv?: string | null;
  request: Pick<Request, "url" | "headers">;
}) {
  if (input.nodeEnv === "production") {
    return false;
  }

  const requestUrlHost = parseRequestHost(input.request.url);

  if (requestUrlHost && !isLoopbackHost(requestUrlHost)) {
    return false;
  }

  const originHost = parseRequestHost(input.request.headers.get("origin"));

  if (originHost && !isLoopbackHost(originHost)) {
    return false;
  }

  const refererHost = parseRequestHost(input.request.headers.get("referer"));

  if (refererHost && !isLoopbackHost(refererHost)) {
    return false;
  }

  const forwardedHost = parseRequestHost(
    input.request.headers.get("x-forwarded-host"),
  );

  if (forwardedHost && !isLoopbackHost(forwardedHost)) {
    return false;
  }

  return true;
}

export async function createDevelopmentFallbackToken(input: {
  serviceRoleKey?: string | null;
  devActorUserId?: string | null;
}) {
  if (!input.serviceRoleKey) {
    return null;
  }

  const actorUserId = resolveDevelopmentFallbackActorUserId({
    devActorUserId: input.devActorUserId,
  });
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(input.serviceRoleKey),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${DEVELOPMENT_FALLBACK_PURPOSE}:${actorUserId}`),
  );

  return bytesToHex(new Uint8Array(signature));
}

export async function requestHasValidDevelopmentFallbackToken(input: {
  request: Pick<Request, "headers">;
  serviceRoleKey?: string | null;
  devActorUserId?: string | null;
}) {
  const providedToken = readDevelopmentFallbackToken(input.request);

  if (!providedToken) {
    return false;
  }

  const expectedToken = await createDevelopmentFallbackToken({
    serviceRoleKey: input.serviceRoleKey,
    devActorUserId: input.devActorUserId,
  });

  return expectedToken ? safeEqual(providedToken, expectedToken) : false;
}
