import { NextResponse, type NextRequest } from "next/server";
import {
  GUEST_SHARE_COOKIE_NAME,
  hasActiveGuestShareCookie,
} from "./server/auth/guestShareSession";
import { updateSupabaseSession } from "./server/auth/updateSupabaseSession";

/**
 * NocPulse auth middleware.
 *
 * For every matched route (see `config.matcher` below) this middleware:
 *   1. Refreshes the Supabase session cookies via `updateSupabaseSession`.
 *   2. Verifies the request resolves to a live Supabase session.
 *   3. Redirects unauthenticated visitors to /auth/sign-in?next={path}.
 *
 * The middleware only protects page routes. API routes return JSON auth
 * errors from their own handlers so they are excluded from this matcher.
 */
export async function middleware(request: NextRequest) {
  const hasActiveGuestShareSession =
    request.nextUrl.pathname.startsWith("/preview") &&
    hasActiveGuestShareCookie(
      request.cookies.get(GUEST_SHARE_COOKIE_NAME)?.value,
    );

  // 1. Try to refresh the session. If Supabase isn't configured (dev mode), skip gracefully.
  let response: NextResponse;
  let hasValidSession = false;
  try {
    const session = await updateSupabaseSession(request);
    response = session.response;
    hasValidSession = session.hasValidSession;
  } catch {
    // Supabase not configured — pass through without auth check (dev mode)
    return NextResponse.next();
  }

  if (hasValidSession || hasActiveGuestShareSession) {
    return response;
  }

  // 3. No valid session — redirect to sign-in, preserving the intended path.
  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = "/auth/sign-in";
  signInUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(signInUrl);
}

/**
 * Match all routes EXCEPT:
 *   - /_next/*          (static assets, HMR, etc.)
 *   - /fonts/*          (self-hosted fonts)
 *   - /logo.svg         (brand mark)
 *   - /favicon.ico      (browser icon)
 *   - /api/*            (API routes handle auth as JSON)
 *   - /auth/*           (sign-in, check-email, callback pages)
 *   - /request-access   (public lead capture)
 *   - /share/*          (public share links)
 */
export const config = {
  matcher: [
    /*
     * Next.js middleware matcher syntax:
     *   - Negative lookahead (?!...) excludes the listed prefixes.
     *   - The trailing /:path* matches everything else.
     */
    "/((?!_next|fonts|logo\\.svg|favicon\\.ico|api|auth|request-access|share).*)",
  ],
};
