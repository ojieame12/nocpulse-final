import { jsonError, jsonOk } from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import { logServerError } from "../../../../../server/runtime/installServerCrashLogging";
import { resolveGuestShareSessionFromRequest } from "../../../../../server/auth/guestShareSession";
import { buildFieldOverviewViewModel } from "../../../../../features/fields/buildFieldOverviewViewModel";
import { resolvePreferredWorkspaceId } from "../../../../../server/fields/resolvePreferredWorkspaceId";

export const dynamic = "force-dynamic";

function buildNormalizedRequest(
  request: Request,
  preferredWorkspaceId: string | undefined,
) {
  const headers = new Headers(request.headers);

  if (preferredWorkspaceId) {
    headers.set("x-fieldpulse-workspace-id", preferredWorkspaceId);
  } else {
    headers.delete("x-fieldpulse-workspace-id");
  }

  return new Request(request.url, {
    method: request.method,
    headers,
  });
}

/**
 * GET /api/fields/:fieldId/overview
 *
 * Returns the full field overview view model — map preview, panels, sidebar data —
 * for client-side field switching without a full page navigation.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ fieldId: string }> },
) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const { fieldId } = await context.params;
    const guestShareSession = await resolveGuestShareSessionFromRequest({
      request,
      runtime,
    });

    if (guestShareSession && guestShareSession.fieldId !== fieldId) {
      return jsonError(
        403,
        "Shared guest access is limited to the linked field.",
      );
    }

    const preferredWorkspaceId = guestShareSession?.workspaceId ?? await resolvePreferredWorkspaceId(
      runtime,
      request.headers.get("x-fieldpulse-workspace-id"),
    );
    const normalizedRequest = buildNormalizedRequest(
      request,
      preferredWorkspaceId,
    );
    const viewModel = await buildFieldOverviewViewModel(fieldId, {
      preferredWorkspaceId,
      request: normalizedRequest,
      guestShareSession,
    });

    if (viewModel.status === "unauthenticated") {
      return jsonError(401, viewModel.authMessage ?? "Authentication required.");
    }

    if (viewModel.status === "not-found") {
      return jsonError(404, `Field ${fieldId} not found.`);
    }

    // Return the serializable parts the client shell needs
    return jsonOk({
      status: "ready",
      workspaceId: viewModel.workspaceId,
      fieldId: viewModel.fieldId,
      fieldName: viewModel.fieldName,
      areaHaLabel: viewModel.areaHaLabel,
      mapPreview: viewModel.mapPreview,
      sidebarFields: viewModel.sidebarFields,
      summary: viewModel.summary,
      alertsPanel: viewModel.alertsPanel,
      activityPanel: viewModel.activityPanel,
      reportPanel: viewModel.reportPanel,
      actionPanel: viewModel.actionPanel,
      notesPanel: viewModel.notesPanel,
      marketPanel: viewModel.marketPanel,
      cropPanel: viewModel.cropPanel,
      cellInspector: viewModel.cellInspector,
    });
  } catch (error: unknown) {
    logServerError("field-overview-route", error, {
      route: "/api/fields/[fieldId]/overview",
    });
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return jsonError(500, message);
  }
}
