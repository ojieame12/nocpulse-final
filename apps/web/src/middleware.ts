import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "./server/auth/updateSupabaseSession";
import { collectSupabaseAuthCookieNames } from "./server/auth/extractSupabaseAccessToken";

/**
 * NocPulse auth middleware.
 *
 * For every matched route (see `config.matcher` below) this middleware:
 *   1. Refreshes the Supabase session cookies via `updateSupabaseSession`.
 *   2. Checks whether any recognised Supabase auth cookie exists.
 *   3. Redirects unauthenticated visitors to /auth/sign-in?next={path}.
 *
 * It intentionally does NOT validate the JWT — pages resolve the actor
 * themselves. The middleware only gates access to protected routes.
 */
export async function middleware(request: NextRequest) {
  // 1. Refresh the session (sets updated cookies on the response).
  const response = await updateSupabaseSession(request);

  // 2. Check for the presence of any Supabase auth cookie.
  const knownNames = collectSupabaseAuthCookieNames();
  const cookies = request.cookies.getAll();

  const hasAuthCookie = cookies.some((cookie) => {
    // Exact match on known cookie names
    if (knownNames.has(cookie.name)) {
      return true;
    }
    // Chunked cookies: sb-<ref>-auth-token.0, sb-<ref>-auth-token.1, ...
    if (/^sb-.+-auth-token(\.\d+)?$/.test(cookie.name)) {
      return true;
    }
    return false;
  });

  if (hasAuthCookie) {
    return response;
  }

  // 3. No auth cookies — redirect to sign-in, preserving the intended path.
  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = "/auth/sign-in";
  signInUrl.searchParams.set("next", request.nextUrl.pathname);

  return NextResponse.redirect(signInUrl);
}

/**
 * Match all routes EXCEPT:
 *   - /_next/*          (static assets, HMR, etc.)
 *   - /fonts/*          (self-hosted fonts)
 *   - /logo.svg         (brand mark)
 *   - /favicon.ico      (browser icon)
 *   - /api/auth/*       (auth API callbacks)
 *   - /auth/*           (sign-in, check-email, callback pages)
 *   - /share/*          (public share links)
 */
export const config = {
  matcher: [
    /*
     * Next.js middleware matcher syntax:
     *   - Negative lookahead (?!...) excludes the listed prefixes.
     *   - The trailing /:path* matches everything else.
     */
    "/((?!_next|fonts|logo\\.svg|favicon\\.ico|api/auth|auth|share).*)",
  ],
};
