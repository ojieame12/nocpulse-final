import { jsonError, jsonServerError } from "../../../../../server/http/json";
import { buildFieldOverviewViewModel } from "../../../../../features/fields/buildFieldOverviewViewModel";
import { prepareFieldCropReportArtifact } from "../../../../../server/exports/prepareFieldCropReportArtifact";

export const dynamic = "force-dynamic";

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

    const panels = await viewModel.resolvePanels();
    const prepared = prepareFieldCropReportArtifact({
      fieldId: viewModel.fieldId,
      fieldName: viewModel.fieldName,
      areaLabel: viewModel.areaHaLabel,
      summary: viewModel.summary,
      crop: panels.cropPanel,
    });

    return new Response(Buffer.from(prepared.bytes), {
      status: 200,
      headers: {
        "content-type": prepared.contentType,
        "cache-control": prepared.cacheControl,
        "content-disposition": `attachment; filename="${prepared.fileName}"`,
      },
    });
  } catch (error) {
    return jsonServerError(error, {
      event: "crop-report-export-route",
      message: "Crop report export failed.",
    });
  }
}
