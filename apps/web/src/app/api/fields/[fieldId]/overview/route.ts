import { jsonError, jsonOk } from "../../../../../server/http/json";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import { logServerError } from "../../../../../server/runtime/installServerCrashLogging";
import { buildFieldOverviewViewModel } from "../../../../../features/fields/buildFieldOverviewViewModel";

export const dynamic = "force-dynamic";

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function resolvePreferredWorkspaceId(
  runtime: ReturnType<typeof getWebServerRuntime>,
  workspaceHeader: string | null,
) {
  const rawValue = workspaceHeader?.trim() ?? "";

  if (!rawValue) {
    return undefined;
  }

  if (isUuidLike(rawValue)) {
    return rawValue;
  }

  if (runtime.mode !== "supabase") {
    return undefined;
  }

  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });
  const result = await client
    .from("workspaces")
    .select("id")
    .eq("slug", rawValue)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data?.id ?? undefined;
}

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
    logServerError("field-overview-route", error, {
      route: "/api/fields/[fieldId]/overview",
    });
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return jsonError(500, message);
  }
}
