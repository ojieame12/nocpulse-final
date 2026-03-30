import {
  DEFAULT_MAP_LIGHTING_PRESET,
  MAP_RENDERING_GUARDRAILS,
} from "@fieldpulse/map";
import { RequestContextError } from "../../server/runtime/resolveRequestContext";
import { getWebServerRuntime } from "../../server/runtime/getWebServerRuntime";
import { resolveServerComponentActorContext } from "../../server/runtime/resolveServerComponentActorContext";
import { loadLiveHomeData } from "./loadLiveHomeData";
import type { SidebarFieldItem } from "../../components/layout/Sidebar";

function deriveSidebarStatus(input: {
  rootZonePct?: number | null;
  confidence?: "low" | "medium" | "high" | null;
}): SidebarFieldItem["status"] {
  if (input.rootZonePct == null) {
    return "pending";
  }
  if (input.rootZonePct < 25) {
    return "stressed";
  }
  if (input.rootZonePct < 35 || input.confidence === "low") {
    return "warning";
  }
  return "healthy";
}

export async function buildHomeViewModel() {
  const runtime = getWebServerRuntime();
  const actorContext = await resolveServerComponentActorContext(runtime).catch(
    (error: unknown) => {
      if (error instanceof RequestContextError) {
        return {
          actor: null,
          authMode: "development-fallback" as const,
          authRedirectPath:
            error.status === 403
              ? "/auth/pending-access?next=%2F"
              : null,
          authModeLabel:
            error.status === 401
              ? "No Supabase session available"
              : "Authenticated actor access denied",
          actorErrorMessage: error.message,
        };
      }

      throw error;
    },
  );
  const liveData = await loadLiveHomeData(runtime, actorContext).catch((error: unknown) => ({
    fieldLabel: "Live field load failed",
    moistureLabel: "Live moisture load failed",
    workspaceLabel: "Workspace lookup failed",
    liveDataLabel:
      error instanceof Error
        ? `Live Supabase read failed: ${error.message}`
        : "Live Supabase read failed.",
    liveFields: [],
    bootstrapHint: undefined,
  }));

  return {
    appName: runtime.env.publicAppName,
    fieldLabel: liveData.fieldLabel,
    moistureLabel: liveData.moistureLabel,
    workspaceLabel: liveData.workspaceLabel,
    liveDataLabel: liveData.liveDataLabel,
    liveFields: liveData.liveFields,
    bootstrapHint: liveData.bootstrapHint,
    authRedirectPath:
      "authRedirectPath" in actorContext
        ? actorContext.authRedirectPath
        : null,
    authMode: actorContext.actor ? actorContext.authMode : "none",
    authStatusLabel: actorContext.authModeLabel,
    authActorLabel: actorContext.actor
      ? `${actorContext.actor.userId} · ${actorContext.actor.role}`
      : "No resolved actor",
    defaultLightingPresetId: DEFAULT_MAP_LIGHTING_PRESET.id,
    renderingGuardrails: [...MAP_RENDERING_GUARDRAILS],
    dataRuntimeLabel:
      runtime.mode === "supabase"
        ? `Supabase runtime ready (${runtime.env.supabase.projectRef ?? "unknown project"})`
        : "Supabase runtime not configured",
    r2RuntimeLabel: runtime.env.r2.enabled
      ? `R2 ready (${runtime.env.r2.bucket ?? "bucket pending"})`
      : "R2 not configured",
    databaseUrlPresent: Boolean(runtime.env.databaseUrl),
    devSelectorLabel:
      actorContext.authModeLabel ??
      "Request-context auth resolution unavailable",
    /** Shell-ready sidebar fields */
    sidebarFields: liveData.liveFields.map((f): SidebarFieldItem => ({
      id: f.id,
      name: f.name,
      area: f.areaHaLabel,
      status: deriveSidebarStatus({
        rootZonePct: f.latestMoisture?.rootZonePct ?? null,
        confidence: f.latestMoisture?.confidence ?? null,
      }),
    })),
  };
}
