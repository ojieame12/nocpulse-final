import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../server/auth/createRouteHandlerSupabaseClient";

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/";
  }

  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(nextPath, url.origin));

  if (!code) {
    return NextResponse.redirect(new URL("/?auth=missing-code", url.origin));
  }

  const { client } = createRouteHandlerSupabaseClient(request, response);
  const result = await client.auth.exchangeCodeForSession(code);

  if (result.error) {
    return NextResponse.redirect(new URL("/?auth=callback-error", url.origin));
  }

  return response;
}
