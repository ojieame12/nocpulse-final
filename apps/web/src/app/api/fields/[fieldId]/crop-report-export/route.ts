import { jsonError } from "../../../../../server/http/json";
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

    const crop = viewModel.cropPanel;
    const summary = viewModel.summary;
    const prepared = prepareFieldCropReportArtifact({
      fieldId,
      fieldName: viewModel.fieldName,
      areaLabel: viewModel.areaHaLabel,
      crop,
      summary,
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
    return jsonError(
      500,
      error instanceof Error ? error.message : "Crop report export failed.",
    );
  }
}
