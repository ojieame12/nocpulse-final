import { jsonError, jsonServerError } from "../../../../../server/http/json";
import { buildFieldOverviewViewModel } from "../../../../../features/fields/buildFieldOverviewViewModel";
import { prepareFieldReportArtifact } from "@fieldpulse/module-reports";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import { loadPdfBrandLogo } from "../../../../../server/exports/loadPdfBrandLogo";

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
    const { fieldId } = await context.params;
    const { searchParams } = new URL(request.url);
    const preferredWorkspaceId = searchParams.get("workspaceId")?.trim() || undefined;
    const viewModel = await buildFieldOverviewViewModel(fieldId, {
      preferredWorkspaceId,
      request,
    });

    if (viewModel.status === "unauthenticated") {
      return jsonError(401, viewModel.authMessage ?? "Authentication required.");
    }

    if (viewModel.status === "not-found") {
      return jsonError(404, `Field ${fieldId} not found.`);
    }

    const generatedAt = new Date().toISOString();
    const runtime = getWebServerRuntime();
    if (!runtime.services) {
      throw new Error("Server runtime services are unavailable for field report export.");
    }
    const readModel = await runtime.services.reports.buildFieldReadModel({
      workspaceId: viewModel.workspaceId,
      fieldId: viewModel.fieldId,
      reportDate: generatedAt,
    });
    const brandLogo = loadPdfBrandLogo();
    const prepared = prepareFieldReportArtifact({
      readModel,
      brandLogoPngBytes: brandLogo ?? undefined,
    });
    const fileName = `${slugify(viewModel.fieldName)}-field-report-${generatedAt.slice(0, 10)}.pdf`;

    return new Response(Buffer.from(prepared.bytes), {
      status: 200,
      headers: {
        "content-type": prepared.contentType,
        "cache-control": prepared.cacheControl,
        "content-disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return jsonServerError(error, {
      event: "field-report-export-route",
      message: "Field report export failed.",
    });
  }
}
