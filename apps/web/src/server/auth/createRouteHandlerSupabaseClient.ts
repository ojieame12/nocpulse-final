import {
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import { NextResponse } from "next/server";
import { getSupabaseAuthConfig } from "./getSupabaseAuthConfig";
import { parseCookieHeader } from "./extractSupabaseAccessToken";

export function createRouteHandlerSupabaseClient(
  request: Request,
  response: NextResponse = NextResponse.next(),
) {
  const config = getSupabaseAuthConfig();
  const cookies = parseCookieHeader(request.headers.get("cookie") ?? "");
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookies;
    },
    setAll(cookiesToSet) {
      for (const cookie of cookiesToSet) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
    },
  };

  const client = createServerClient(config.url, config.anonKey, {
    cookies: cookieMethods,
  });

  return {
    client,
    response,
    config,
  };
}
