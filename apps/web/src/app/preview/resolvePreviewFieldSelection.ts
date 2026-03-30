import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import type { FieldBoundaryPreviewRenderModel } from "@fieldpulse/map/server";
import { getWebServerRuntime } from "../../server/runtime/getWebServerRuntime";
import { resolveServerComponentActorContext } from "../../server/runtime/resolveServerComponentActorContext";

const HOPE_CREEK_WORKSPACE_SLUG = "hope-creek-farms";

type PreviewWorkspaceSelection = {
  id: string;
  slug: string;
};

type PreviewFieldSelection = {
  id: string;
};

type PreviewFieldSelectionResult =
  | { status: "no-runtime" }
  | { status: "unauthenticated" }
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

  const actorContext = await resolveServerComponentActorContext(runtime).catch(() => ({
    actor: null,
    authMode: "none" as const,
    authModeLabel: "No actor available",
    actorErrorMessage: "Authentication unavailable",
  }));

  if (!actorContext.actor) {
    return { status: "unauthenticated" };
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

export function resolvePreferredPreviewWorkspaceId(
  workspaces: readonly PreviewWorkspaceSelection[],
  fallbackWorkspaceId: string,
) {
  return (
    workspaces.find((workspace) => workspace.slug === HOPE_CREEK_WORKSPACE_SLUG)?.id ??
    fallbackWorkspaceId
  );
}

export function resolvePreviewFieldId(
  fields: readonly PreviewFieldSelection[],
  primaryFieldId: string,
  requestedFieldId?: string,
) {
  return fields.some((field) => field.id === requestedFieldId)
    ? requestedFieldId!
    : primaryFieldId;
}
