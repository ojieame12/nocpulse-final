import type { CreateFieldInput, GeoPoint } from "@fieldpulse/module-fields";
import type { ParsedLldCode } from "./LldComponents";

export type FieldDraft = Omit<CreateFieldInput, "workspaceId">;

export type GeoBoundingBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type LookupLldBoundaryInput = {
  code: string;
  suggestedFieldName?: string;
};

export type LldLookupResolution = "cached" | "synthetic";

export type LldLookupResult = {
  parsed: ParsedLldCode;
  draft: FieldDraft;
  centroid: GeoPoint;
  bbox: GeoBoundingBox;
  resolution: LldLookupResolution;
};
