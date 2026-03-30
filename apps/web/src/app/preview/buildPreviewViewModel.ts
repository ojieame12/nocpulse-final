import { resolveFieldBoundaryPreviewPresentation } from "@fieldpulse/map/server";
import type { FieldBoundaryPreviewRenderModel } from "@fieldpulse/map";
import { buildFieldOverviewViewModel } from "../../features/fields/buildFieldOverviewViewModel";
import { resolvePreviewFieldSelection } from "./resolvePreviewFieldSelection";
import { getWebServerRuntime } from "../../server/runtime/getWebServerRuntime";
import { createServerComponentRequest } from "../../server/runtime/createServerComponentRequest";
import { resolveRequestAuthViewer, type AuthViewer } from "../../server/auth/resolveAuthViewer";

/**
 * Resolve the authenticated viewer for the TopBar avatar / identity display.
 * Returns null silently if resolution fails (the shell still renders, just
 * without the viewer badge — same as before this change).
 */
async function resolvePreviewViewer(
  preferredWorkspaceId?: string,
): Promise<AuthViewer | null> {
  try {
    const runtime = getWebServerRuntime();
    if (runtime.mode !== "supabase") return null;
    const request = await createServerComponentRequest("/");
    const { viewer } = await resolveRequestAuthViewer({
      request,
      runtime,
      preferredWorkspaceId,
    });
    return viewer;
  } catch {
    return null;
  }
}

/**
 * Stub map preview for empty workspaces — shows a satellite basemap
 * centered on a neutral location with no cells or boundary.
 */
function buildEmptyMapPreview(): FieldBoundaryPreviewRenderModel {
  const presentation = resolveFieldBoundaryPreviewPresentation({ viewportPaddingPx: 60 });
  return {
    fieldId: "__empty__",
    fieldName: "",
    bbox: [-104.98, 39.73, -104.94, 39.76] as const, // neutral centroid
    labelPoint: [-104.96, 39.745],
    boundaryFeature: {
      type: "Feature",
      properties: { fieldId: "__empty__", fieldName: "" },
      geometry: { type: "MultiPolygon", coordinates: [] },
    },
    agronomicSurface: null,
    presentation,
  };
}

/**
 * Server-side data loader for the preview page.
 *
 * Loads the workspace field list + the first (or specified) field's full
 * view model so the client shell can render immediately with real data.
 */
export async function buildPreviewViewModel(initialFieldId?: string) {
  const selection = await resolvePreviewFieldSelection(initialFieldId);

  if (selection.status === "no-runtime") {
    return { status: "no-runtime" as const };
  }

  if (selection.status === "unauthenticated") {
    return { status: "unauthenticated" as const };
  }

  // Empty workspace — render the full shell with no field data
  if (selection.status === "no-fields") {
    const viewer = await resolvePreviewViewer();
    return {
      status: "ready" as const,
      viewer,
      workspaceId: "__empty__",
      fieldId: "__empty__",
      fieldName: "",
      areaHaLabel: "",
      mapPreview: buildEmptyMapPreview(),
      sidebarFields: [],
      summary: null,
      alertsPanel: null,
      activityPanel: null,
      reportPanel: null,
      actionPanel: null,
      notesPanel: null,
      marketPanel: null,
      cropPanel: null,
      cellInspector: null,
      panelsPromise: Promise.resolve({}),
    };
  }

  const [viewModel, viewer] = await Promise.all([
    buildFieldOverviewViewModel(selection.selectedFieldId, {
      preferredWorkspaceId: selection.preferredWorkspaceId,
    }),
    resolvePreviewViewer(selection.preferredWorkspaceId),
  ]);

  if (viewModel.status !== "ready") {
    return {
      status: viewModel.status as "unauthenticated" | "not-found",
    };
  }

  return {
    status: "ready" as const,
    viewer,
    workspaceId: viewModel.workspaceId,
    fieldId: viewModel.fieldId,
    fieldName: viewModel.fieldName,
    areaHaLabel: viewModel.areaHaLabel,
    mapPreview: {
      ...viewModel.mapPreview,
      workspaceFieldFeatures: selection.workspaceFieldFeatures,
    },
    sidebarFields: viewModel.sidebarFields,
    summary: viewModel.summary,
    alertsPanel: viewModel.alertsPanel,
    activityPanel: null,
    reportPanel: null,
    actionPanel: null,
    notesPanel: null,
    marketPanel: null,
    cropPanel: null,
    cellInspector: viewModel.cellInspector,
    panelsPromise: viewModel.resolvePanels(),
  };
}
