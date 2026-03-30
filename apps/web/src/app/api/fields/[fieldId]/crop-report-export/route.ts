import { jsonError } from "../../../../../server/http/json";
import { buildFieldOverviewViewModel } from "../../../../../features/fields/buildFieldOverviewViewModel";

export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pushSection(lines: string[], heading: string, rows: readonly string[]) {
  lines.push(`## ${heading}`);
  if (rows.length === 0) {
    lines.push("- None");
  } else {
    lines.push(...rows);
  }
  lines.push("");
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
    });

    if (viewModel.status === "unauthenticated") {
      return jsonError(401, viewModel.authMessage ?? "Authentication required.");
    }

    if (viewModel.status === "not-found") {
      return jsonError(404, `Field ${fieldId} not found.`);
    }

    const crop = viewModel.cropPanel;
    const summary = viewModel.summary;
    const lines: string[] = [
      `# Crop Report: ${viewModel.fieldName}`,
      "",
      `- Generated: ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
      `- Legal land description: ${crop?.lld ?? "—"}`,
      `- Area: ${viewModel.areaHaLabel}`,
      `- Crop: ${crop?.cropName ?? summary?.crop ?? "—"}`,
      `- Stage: ${summary?.cropStage ?? crop?.thresholdStageLabel ?? "—"}`,
      "",
    ];

    pushSection(lines, "Signal Summary", [
      `- ${crop?.healthIndexTitle ?? "Health"}: ${crop?.healthIndex.label ?? "—"} (${crop?.healthIndex.subLabel ?? "unavailable"})`,
      `- ${crop?.moistureBalanceTitle ?? "Moisture"}: ${crop?.moistureBalance.label ?? "—"} (${crop?.moistureBalance.subLabel ?? "unavailable"})`,
      `- GDD: ${crop?.accumulatedGddLabel ?? "—"} (${crop?.gddUnitLabel ?? "unavailable"})`,
    ]);

    pushSection(
      lines,
      "Thresholds",
      (crop?.thresholds ?? []).map(
        (threshold) =>
          `- ${threshold.param}: min ${threshold.min} · optimal ${threshold.optimal} · max ${threshold.max} · status ${threshold.status}`,
      ),
    );

    pushSection(
      lines,
      "Field Context",
      (crop?.fieldTiles ?? []).map(
        (tile) => `- ${tile.label}: ${tile.value} (${tile.sub})`,
      ),
    );

    pushSection(
      lines,
      "Disease Risks",
      (crop?.diseaseRisks ?? []).map(
        (risk) => `- ${risk.name}: ${risk.pct} · ${risk.desc}`,
      ),
    );

    pushSection(
      lines,
      "Provenance",
      (crop?.provenanceRows ?? []).map(
        (row) => `- ${row.key}: ${row.value}`,
      ),
    );

    if (crop?.footer) {
      lines.push(`_ ${crop.footer}`);
      lines.push("");
    }

    const body = lines.join("\n");
    const fileName = `${slugify(viewModel.fieldName)}-crop-report-${new Date().toISOString().slice(0, 10)}.md`;

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "private, max-age=0, no-cache",
        "content-disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Crop report export failed.",
    );
  }
}
