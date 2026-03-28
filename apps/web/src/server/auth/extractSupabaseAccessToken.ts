function looksLikeJwt(value: string) {
  return value.split(".").length === 3;
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractTokenFromCookieValue(value: string) {
  const decoded = decodeCookieValue(value).trim();

  if (looksLikeJwt(decoded)) {
    return decoded;
  }

  try {
    const parsed = JSON.parse(decoded) as unknown;

    if (typeof parsed === "string" && looksLikeJwt(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed) && typeof parsed[0] === "string" && looksLikeJwt(parsed[0])) {
      return parsed[0];
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "access_token" in parsed &&
      typeof parsed.access_token === "string" &&
      looksLikeJwt(parsed.access_token)
    ) {
      return parsed.access_token;
    }
  } catch {
    return null;
  }

  return null;
}

export function parseCookieHeader(header: string) {
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

export function collectSupabaseAuthCookieNames(projectRef?: string) {
  const names = new Set<string>([
    "sb-access-token",
    "sb-auth-token",
  ]);

  if (projectRef) {
    names.add(`sb-${projectRef}-auth-token`);
  }

  return names;
}

export function extractSupabaseAccessToken(
  request: Request,
  options: {
    projectRef?: string;
  } = {},
) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();

    if (token) {
      return token;
    }
  }

  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookieHeader(cookieHeader);
  const exactNames = collectSupabaseAuthCookieNames(options.projectRef);
  const exactMatch = cookies.find((cookie) => exactNames.has(cookie.name));

  if (exactMatch) {
    const token = extractTokenFromCookieValue(exactMatch.value);

    if (token) {
      return token;
    }
  }

  const chunkGroups = new Map<string, Array<{ index: number; value: string }>>();

  for (const cookie of cookies) {
    const exactToken = exactNames.has(cookie.name)
      ? extractTokenFromCookieValue(cookie.value)
      : null;

    if (exactToken) {
      return exactToken;
    }

    const chunkMatch = cookie.name.match(/^(sb-[^.]+-auth-token)\.(\d+)$/);

    if (!chunkMatch) {
      continue;
    }

    const baseName = chunkMatch[1];

    if (!exactNames.has(baseName)) {
      continue;
    }

    const entries = chunkGroups.get(baseName) ?? [];
    entries.push({
      index: Number.parseInt(chunkMatch[2], 10),
      value: cookie.value,
    });
    chunkGroups.set(baseName, entries);
  }

  for (const entries of chunkGroups.values()) {
    const combined = entries
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.value)
      .join("");
    const token = extractTokenFromCookieValue(combined);

    if (token) {
      return token;
    }
  }

  return null;
}
