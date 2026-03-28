import type { ServerRuntime } from "@fieldpulse/platform-runtime";

type LiveHomeActor = {
  userId: string;
  workspaceId: string;
  role: string;
};

type LiveHomeData = {
  fieldLabel: string;
  moistureLabel: string;
  workspaceLabel: string;
  liveDataLabel: string;
  liveFields: readonly {
    id: string;
    name: string;
    areaHaLabel: string;
    moistureLabel: string;
    latestMoisture: {
      rootZonePct: number;
      surfacePct: number;
      confidence: "low" | "medium" | "high";
      sourceKey: string;
    } | null;
  }[];
  bootstrapHint?: string;
};

type LoadLiveHomeDataOptions = {
  actor?: LiveHomeActor | null;
  authModeLabel?: string;
  actorErrorMessage?: string;
};

export async function loadLiveHomeData(
  runtime: ServerRuntime,
  options: LoadLiveHomeDataOptions = {},
): Promise<LiveHomeData> {
  if (runtime.mode !== "supabase") {
    return {
      fieldLabel: "No live field selected",
      moistureLabel: "Supabase runtime not configured",
      workspaceLabel: "No workspace selected",
      liveDataLabel: "Configure Supabase service-role access to load live data.",
      liveFields: [],
    };
  }

  if (!options.actor) {
    return {
      fieldLabel: "No authenticated field selected",
      moistureLabel: "No authenticated workspace available",
      workspaceLabel: "Authentication required",
      liveDataLabel:
        options.actorErrorMessage ??
        "No authenticated actor is available for this request.",
      liveFields: [],
    };
  }

  const { selectionMode, selectedWorkspace, fields, primaryField } =
    await runtime.services.catalog.loadWorkspaceFieldOverview({
      actorUserId: options.actor.userId,
      preferredWorkspaceId: options.actor.workspaceId,
  });

  if (!selectedWorkspace) {
    return {
      fieldLabel: "No fields yet",
      moistureLabel: "No moisture snapshots yet",
      workspaceLabel: "No workspace found",
      liveDataLabel:
        selectionMode === "actor"
          ? "The authenticated actor did not resolve to any workspace memberships."
          : "No workspaces exist yet in Supabase.",
      liveFields: [],
      bootstrapHint: "Run `corepack pnpm bootstrap:dev-data` to create the first workspace, field, and moisture snapshot.",
    };
  }

  return {
    fieldLabel: primaryField
      ? `${primaryField.name} · ${primaryField.areaHa.toFixed(1)} ha`
      : "No fields in this workspace",
    moistureLabel: primaryField?.latestMoisture
      ? `Root ${primaryField.latestMoisture.rootZonePct.toFixed(1)}%, surface ${primaryField.latestMoisture.surfacePct.toFixed(1)}%, ${primaryField.latestMoisture.confidence}`
      : "No moisture snapshot for the selected workspace",
    workspaceLabel: `${selectedWorkspace.name} · ${selectedWorkspace.slug}`,
    liveDataLabel:
      options.authModeLabel
        ? `${options.authModeLabel} in workspace ${selectedWorkspace.slug}.`
        : selectionMode === "workspace"
          ? `Live data pinned to workspace ${selectedWorkspace.slug}.`
          : `Live data loaded from the first workspace in Supabase (${selectedWorkspace.slug}).`,
    liveFields: fields.map((field) => ({
      id: field.id,
      name: field.name,
      areaHaLabel: `${field.areaHa.toFixed(1)} ha`,
      moistureLabel: field.latestMoisture
        ? `Moisture ${field.latestMoisture.rootZonePct.toFixed(1)}% / ${field.latestMoisture.surfacePct.toFixed(1)}%`
        : "No moisture snapshot",
      latestMoisture: field.latestMoisture,
    })),
    bootstrapHint: fields.length === 0
      ? "Run `corepack pnpm bootstrap:dev-data` if you want a ready-made workspace sample while the first real ingestion flow is still being built."
      : undefined,
  };
}
