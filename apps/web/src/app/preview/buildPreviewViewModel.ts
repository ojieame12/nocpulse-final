import { buildFieldOverviewViewModel } from "../../features/fields/buildFieldOverviewViewModel";
import { resolveGuestShareSessionFromRequest } from "../../server/auth/guestShareSession";
import {
  resolveRequestAuthViewer,
  type AuthViewer,
} from "../../server/auth/resolveAuthViewer";
import { createServerComponentRequest } from "../../server/runtime/createServerComponentRequest";
import { getWebServerRuntime } from "../../server/runtime/getWebServerRuntime";
import { resolvePreviewFieldSelection } from "./resolvePreviewFieldSelection";

/**
 * Server-side data loader for the preview page.
 *
 * Loads the workspace field list + the first (or specified) field's full
 * view model so the client shell can render immediately with real data.
 */
export async function buildPreviewViewModel(initialFieldId?: string) {
  const runtime = getWebServerRuntime();

  if (runtime.mode === "supabase") {
    const request = await createServerComponentRequest("/preview");
    const guestShareSession = await resolveGuestShareSessionFromRequest({
      request,
      runtime,
    });

    if (guestShareSession) {
      const viewModel = await buildFieldOverviewViewModel(
        guestShareSession.fieldId,
        {
          request,
          guestShareSession,
        },
      );

      if (viewModel.status === "ready") {
        return {
          status: "ready" as const,
          guestSession: {
            expiresAt: guestShareSession.expiresAt,
          },
          workspaceId: viewModel.workspaceId,
          fieldId: viewModel.fieldId,
          fieldName: viewModel.fieldName,
          areaHaLabel: viewModel.areaHaLabel,
          mapPreview: {
            ...viewModel.mapPreview,
            workspaceFieldFeatures: [viewModel.mapPreview.boundaryFeature],
          },
          sidebarFields: viewModel.sidebarFields.filter(
            (field) => field.id === viewModel.fieldId,
          ),
          summary: viewModel.summary,
          alertsPanel: viewModel.alertsPanel,
          activityPanel: viewModel.activityPanel,
          reportPanel: viewModel.reportPanel,
          actionPanel: viewModel.actionPanel,
          notesPanel: viewModel.notesPanel,
          marketPanel: viewModel.marketPanel,
          cropPanel: viewModel.cropPanel,
          cellInspector: viewModel.cellInspector,
        };
      }
    }
  }

  const selection = await resolvePreviewFieldSelection(initialFieldId);

  if (selection.status === "no-runtime") {
    return { status: "no-runtime" as const };
  }

  if (selection.status === "unauthenticated") {
    return { status: "unauthenticated" as const };
  }

  if (selection.status === "pending-access") {
    return { status: "pending-access" as const };
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

  let authViewer: AuthViewer | null = null;

  if (runtime.mode === "supabase") {
    const request = await createServerComponentRequest("/preview");

    try {
      const resolved = await resolveRequestAuthViewer({
        request,
        runtime,
        preferredWorkspaceId: selection.preferredWorkspaceId,
      });

      authViewer = resolved.viewer;
    } catch {
      authViewer = null;
    }
  }

  return {
    status: "ready" as const,
    authViewer,
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
    activityPanel: viewModel.activityPanel,
    reportPanel: viewModel.reportPanel,
    actionPanel: viewModel.actionPanel,
    notesPanel: viewModel.notesPanel,
    marketPanel: viewModel.marketPanel,
    cropPanel: viewModel.cropPanel,
    cellInspector: viewModel.cellInspector,
  };
}
