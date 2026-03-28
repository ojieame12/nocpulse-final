import { jsonError, jsonOk, readJsonObject } from "../../../../server/http/json";
import { createRouteHandlerSupabaseClient } from "../../../../server/auth/createRouteHandlerSupabaseClient";

function sanitizeNextPath(value: unknown) {
  return typeof value === "string" && value.startsWith("/") ? value : "/";
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const allowSignup = typeof body.allowSignup === "boolean" ? body.allowSignup : false;
  const nextPath = sanitizeNextPath(body.next);

  if (!email) {
    return jsonError(400, "Field `email` is required.");
  }

  try {
    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("next", nextPath);
    const { client } = createRouteHandlerSupabaseClient(request);
    const result = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: allowSignup,
      },
    });

    if (result.error) {
      return jsonError(400, result.error.message);
    }

    return jsonOk({
      ok: true,
      email,
      next: nextPath,
    });
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Email sign-in failed.",
    );
  }
}
