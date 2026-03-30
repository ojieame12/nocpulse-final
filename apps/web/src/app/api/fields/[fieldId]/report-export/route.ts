import { prepareFieldReportArtifact } from "@fieldpulse/module-reports";
import { jsonError } from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fieldId: string }> },
) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime);
    const { fieldId } = await context.params;
    const { searchParams } = new URL(request.url);
    const preferredWorkspaceId = searchParams.get("workspaceId")?.trim() || actor.workspaceId;
    const reportDate = searchParams.get("reportDate")?.trim() || undefined;

    const readModel = await runtime.services.reports.buildFieldReadModel({
      workspaceId: preferredWorkspaceId,
      fieldId,
      reportDate,
    });
    const prepared = prepareFieldReportArtifact({
      readModel,
      dryRun: false,
    });
    const fileName = `${slugify(readModel.field.name)}-${readModel.reportDate.slice(0, 10)}.pdf`;

    return new Response(Buffer.from(prepared.bytes), {
      status: 200,
      headers: {
        "content-type": prepared.contentType,
        "cache-control": prepared.cacheControl,
        "content-disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Field report export failed.",
    );
  }
}
