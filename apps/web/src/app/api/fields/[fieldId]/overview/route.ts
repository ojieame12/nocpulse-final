import { jsonError, jsonOk, jsonServerError } from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
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
    const preferredWorkspaceId = await resolvePreferredWorkspaceId(
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
    });

    if (viewModel.status === "unauthenticated") {
      return jsonError(401, viewModel.authMessage ?? "Authentication required.");
    }

    if (viewModel.status === "not-found") {
      return jsonError(404, `Field ${fieldId} not found.`);
    }

    const panels = await viewModel.resolvePanels();

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
      activityPanel: panels.activityPanel,
      reportPanel: panels.reportPanel,
      actionPanel: panels.actionPanel,
      notesPanel: panels.notesPanel,
      marketPanel: panels.marketPanel,
      cropPanel: panels.cropPanel,
      cellInspector: viewModel.cellInspector,
    });
  } catch (error: unknown) {
    return jsonServerError(error, {
      event: "field-overview-route",
      message: "Field overview could not be loaded right now.",
      context: {
        route: "/api/fields/[fieldId]/overview",
      },
    });
  }
}
