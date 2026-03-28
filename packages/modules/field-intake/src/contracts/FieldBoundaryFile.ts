import type { FieldBoundary, GeoPoint } from "@fieldpulse/module-fields";
import type { FieldDraft, GeoBoundingBox } from "./LldLookupResult";

export type FieldBoundaryFileFormat = "geojson" | "kml";

export type ParseFieldBoundaryFileInput = {
  content: string;
  fileName?: string;
  mimeType?: string;
  suggestedFieldName?: string;
};

export type ParsedFieldBoundaryFile = {
  format: FieldBoundaryFileFormat;
  draft: FieldDraft;
  centroid: GeoPoint;
  bbox: GeoBoundingBox;
};

export type FieldBoundaryFileCandidate = {
  format: FieldBoundaryFileFormat;
  boundary: FieldBoundary;
  featureName: string | null;
};

export type FieldBoundaryFileParser = {
  parse(
    input: ParseFieldBoundaryFileInput,
  ): Promise<FieldBoundaryFileCandidate> | FieldBoundaryFileCandidate;
};
