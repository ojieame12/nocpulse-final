import { buildFieldOverviewViewModel } from "../../features/fields/buildFieldOverviewViewModel";
import { resolvePreviewFieldSelection } from "./resolvePreviewFieldSelection";

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

  if (selection.status === "no-fields") {
    return { status: "no-fields" as const };
  }

  const viewModel = await buildFieldOverviewViewModel(selection.selectedFieldId, {
    preferredWorkspaceId: selection.preferredWorkspaceId,
  });

  if (viewModel.status !== "ready") {
    return {
      status: viewModel.status as "unauthenticated" | "not-found",
    };
  }

  return {
    status: "ready" as const,
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
