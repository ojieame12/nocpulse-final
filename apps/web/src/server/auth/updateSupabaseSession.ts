import {
  createServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthConfig } from "./getSupabaseAuthConfig";

export async function updateSupabaseSession(request: NextRequest) {
  const config = getSupabaseAuthConfig();
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const cookie of cookiesToSet) {
        request.cookies.set(cookie.name, cookie.value);
      }

      response = NextResponse.next({
        request: {
          headers: request.headers,
        },
      });

      for (const cookie of cookiesToSet) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
    },
  };

  const client = createServerClient(config.url, config.anonKey, {
    cookies: cookieMethods,
  });

  const result = await client.auth.getClaims();

  return {
    response,
    hasValidSession: Boolean(result.data && !result.error),
  };
}
