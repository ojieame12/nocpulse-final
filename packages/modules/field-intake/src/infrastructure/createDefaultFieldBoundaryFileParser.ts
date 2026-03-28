import { DOMParser } from "@xmldom/xmldom";
import { kml as convertKmlToGeoJson } from "@tmcw/togeojson";
import type {
  FieldBoundaryFileCandidate,
  FieldBoundaryFileFormat,
  FieldBoundaryFileParser,
  ParseFieldBoundaryFileInput,
} from "../contracts/FieldBoundaryFile";
import { coerceBoundaryFromGeoJson } from "./coerceBoundaryFromGeoJson";

export function createDefaultFieldBoundaryFileParser(): FieldBoundaryFileParser {
  return {
    parse(input) {
      const format = detectFieldBoundaryFileFormat(input);

      if (format === "geojson") {
        return parseGeoJsonFieldBoundary(input.content);
      }

      return parseKmlFieldBoundary(input.content);
    },
  };
}

function detectFieldBoundaryFileFormat(
  input: ParseFieldBoundaryFileInput,
): FieldBoundaryFileFormat {
  const fileName = input.fileName?.toLowerCase() ?? "";
  const mimeType = input.mimeType?.toLowerCase() ?? "";
  const trimmed = input.content.trimStart();

  if (
    mimeType.includes("geo+json")
    || mimeType.includes("application/json")
    || fileName.endsWith(".geojson")
    || fileName.endsWith(".json")
    || trimmed.startsWith("{")
    || trimmed.startsWith("[")
  ) {
    return "geojson";
  }

  if (
    mimeType.includes("kml")
    || mimeType.includes("xml")
    || fileName.endsWith(".kml")
    || trimmed.startsWith("<")
  ) {
    return "kml";
  }

  throw new Error(
    "[field-intake] file format could not be detected. Use a .geojson, .json, or .kml file.",
  );
}

function parseGeoJsonFieldBoundary(
  content: string,
): FieldBoundaryFileCandidate {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("[field-intake] GeoJSON file could not be parsed");
  }

  const candidate = coerceBoundaryFromGeoJson(parsed);

  return {
    format: "geojson",
    ...candidate,
  };
}

function parseKmlFieldBoundary(content: string): FieldBoundaryFileCandidate {
  const document = new DOMParser().parseFromString(content, "text/xml");
  const geoJson = convertKmlToGeoJson(document as never);
  const candidate = coerceBoundaryFromGeoJson(geoJson);

  return {
    format: "kml",
    ...candidate,
  };
}
