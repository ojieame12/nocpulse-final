import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import type { FieldBoundaryPreviewRenderModel } from "@fieldpulse/map/server";
import { RequestContextError } from "../../server/runtime/resolveRequestContext";
import { getWebServerRuntime } from "../../server/runtime/getWebServerRuntime";
import { resolveServerComponentActorContext } from "../../server/runtime/resolveServerComponentActorContext";
import {
  resolvePreferredPreviewWorkspaceId,
  resolvePreviewFieldId,
  type PreviewFieldSelection,
} from "./resolvePreviewFieldId";

type PreviewFieldSelectionResult =
  | { status: "no-runtime" }
  | { status: "unauthenticated" }
  | { status: "pending-access" }
  | { status: "no-fields" }
  | {
      status: "ready";
      preferredWorkspaceId: string;
      selectedFieldId: string;
      workspaceFieldFeatures: FieldBoundaryPreviewRenderModel["workspaceFieldFeatures"];
    };

export async function resolvePreviewFieldSelection(
  requestedFieldId?: string,
): Promise<PreviewFieldSelectionResult> {
  const runtime = getWebServerRuntime();

  if (runtime.mode !== "supabase") {
    return { status: "no-runtime" };
  }

  const actorContext = await resolveServerComponentActorContext(runtime).catch(
    (error: unknown) => {
      if (error instanceof RequestContextError && error.status === 403) {
        return {
          actor: null,
          authMode: "none" as const,
          authModeLabel: "Authenticated actor access denied",
          actorErrorMessage: error.message,
          authRedirectStatus: "pending-access" as const,
        };
      }

      return {
        actor: null,
        authMode: "none" as const,
        authModeLabel: "No actor available",
        actorErrorMessage: "Authentication unavailable",
        authRedirectStatus: "unauthenticated" as const,
      };
    },
  );

  if (!actorContext.actor) {
    return {
      status:
        "authRedirectStatus" in actorContext
          ? actorContext.authRedirectStatus
          : "unauthenticated",
    };
  }

  const workspaceSelection = await runtime.services.workspaces.resolveSelection({
    actorUserId: actorContext.actor.userId,
    preferredWorkspaceId: actorContext.actor.workspaceId,
  });
  const preferredWorkspaceId = resolvePreferredPreviewWorkspaceId(
    workspaceSelection.workspaces,
    actorContext.actor.workspaceId,
  );

  const { fields, primaryField } =
    await runtime.services.catalog.loadWorkspaceFieldOverview({
      actorUserId: actorContext.actor.userId,
      preferredWorkspaceId,
    });

  if (!primaryField || fields.length === 0) {
    return { status: "no-fields" };
  }

  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });

  const fieldRows = await client
    .from("fields")
    .select("id, name, legal_land_description, boundary")
    .eq("workspace_id", preferredWorkspaceId)
    .order("name", { ascending: true });

  const workspaceFieldFeatures: FieldBoundaryPreviewRenderModel["workspaceFieldFeatures"] =
    fieldRows.error
      ? []
      : (fieldRows.data ?? []).map((row) => ({
          type: "Feature" as const,
          properties: {
            fieldId: row.id,
            fieldName: row.name,
            legalLandDescription: row.legal_land_description ?? null,
          },
          geometry:
            row.boundary as FieldBoundaryPreviewRenderModel["boundaryFeature"]["geometry"],
        }));

  const selectedFieldId = resolvePreviewFieldId(
    fields,
    preferredWorkspaceId,
    primaryField.id,
    requestedFieldId,
  );

  return {
    status: "ready",
    preferredWorkspaceId,
    selectedFieldId,
    workspaceFieldFeatures,
  };
}
