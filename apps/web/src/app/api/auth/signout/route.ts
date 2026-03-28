import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "../../../../server/auth/createRouteHandlerSupabaseClient";
import { jsonError } from "../../../../server/http/json";

export async function POST(request: Request) {
  try {
    const response = NextResponse.json({
      ok: true,
    });
    const { client } = createRouteHandlerSupabaseClient(request, response);
    const result = await client.auth.signOut();

    if (result.error) {
      return jsonError(400, result.error.message);
    }

    return response;
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Sign out failed.",
    );
  }
}
