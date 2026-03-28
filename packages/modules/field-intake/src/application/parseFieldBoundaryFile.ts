import type {
  ParseFieldBoundaryFileCommand,
  ParseFieldBoundaryFileResult,
} from "../contracts/ParseFieldBoundaryFileInput";
import { deriveFieldGeometry } from "../domain/geometry/deriveFieldGeometry";

export async function parseFieldBoundaryFile(
  input: ParseFieldBoundaryFileCommand,
): Promise<ParseFieldBoundaryFileResult> {
  const candidate = await input.parser.parse(input.file);
  const geometry = deriveFieldGeometry(candidate.boundary);

  return {
    format: candidate.format,
    draft: {
      name: getSuggestedFieldName(
        input.file.suggestedFieldName,
        candidate.featureName,
        input.file.fileName,
      ),
      areaHa: geometry.areaHa,
      boundary: candidate.boundary,
    },
    centroid: geometry.centroid,
    bbox: geometry.bbox,
  };
}

function getSuggestedFieldName(
  explicitName: string | undefined,
  featureName: string | null,
  fileName: string | undefined,
) {
  const candidates = [
    explicitName,
    featureName,
    fileName ? stripExtension(fileName) : undefined,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDisplayName(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return "Imported field";
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function normalizeDisplayName(value: string | undefined | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
