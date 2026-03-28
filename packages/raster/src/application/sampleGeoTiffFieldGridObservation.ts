import { fromArrayBuffer, fromUrl } from "geotiff";
import type { RasterFieldGridCell, RasterFieldGridObservation, RasterPoint } from "../contracts/RasterFieldGridObservation";

type RasterFieldGridCellShape = Pick<
  RasterFieldGridCell,
  "cellKey" | "rowIndex" | "columnIndex" | "centroid" | "boundary"
>;

type GeoTiffObservationSource =
  | {
      arrayBuffer: ArrayBuffer;
      url?: never;
    }
  | {
      url: string;
      arrayBuffer?: never;
    };

export type GeoTiffFieldGridObservationInput = GeoTiffObservationSource & {
  sourceKey: string;
  cells: readonly RasterFieldGridCellShape[];
  mapBandsToMeasurements(
    bands: readonly number[],
  ): Readonly<Record<string, number>> | null;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function toArrayBuffer(value: ArrayBuffer) {
  return value.slice(0);
}

function toSampleIndex(
  point: RasterPoint,
  boundingBox: readonly [number, number, number, number],
  width: number,
  height: number,
) {
  const [longitude, latitude] = point;
  const [west, south, east, north] = boundingBox;

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < west ||
    longitude > east ||
    latitude < south ||
    latitude > north
  ) {
    return null;
  }

  const xRatio = (longitude - west) / Math.max(east - west, Number.EPSILON);
  const yRatio = (north - latitude) / Math.max(north - south, Number.EPSILON);
  const pixelX = clamp(Math.floor(xRatio * width), 0, width - 1);
  const pixelY = clamp(Math.floor(yRatio * height), 0, height - 1);

  return pixelY * width + pixelX;
}

function normalizeNoDataValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function hasUsableBands(
  bands: readonly number[],
  noDataValue: number | null,
): boolean {
  return bands.some((value) => {
    if (!Number.isFinite(value)) {
      return false;
    }

    if (noDataValue !== null && value === noDataValue) {
      return false;
    }

    return true;
  });
}

export async function sampleGeoTiffFieldGridObservation({
  sourceKey,
  cells,
  mapBandsToMeasurements,
  ...source
}: GeoTiffFieldGridObservationInput): Promise<RasterFieldGridObservation | null> {
  if (cells.length === 0) {
    return null;
  }

  const geotiff =
    source.arrayBuffer !== undefined
      ? await fromArrayBuffer(toArrayBuffer(source.arrayBuffer))
      : await fromUrl(source.url);
  const image = await geotiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();

  if (width <= 0 || height <= 0) {
    return null;
  }

  const boundingBox = image.getBoundingBox() as unknown as readonly [
    number,
    number,
    number,
    number,
  ];
  const noDataValue = normalizeNoDataValue(image.getGDALNoData());
  const measuredCells: RasterFieldGridCell[] = [];

  for (const cell of cells) {
    const sampleIndex = toSampleIndex(cell.centroid, boundingBox, width, height);

    if (sampleIndex === null) {
      continue;
    }

    const pixelX = sampleIndex % width;
    const pixelY = Math.floor(sampleIndex / width);
    const rasterValues = (await image.readRasters({
      window: [pixelX, pixelY, pixelX + 1, pixelY + 1],
      interleave: true,
      width: 1,
      height: 1,
    })) as unknown as ArrayLike<number>;
    const bands = Array.from(rasterValues, (sample) =>
      typeof sample === "number" ? sample : Number(sample),
    );

    if (!hasUsableBands(bands, noDataValue)) {
      continue;
    }

    const measurements = mapBandsToMeasurements(bands);

    if (!measurements || Object.keys(measurements).length === 0) {
      continue;
    }

    measuredCells.push({
      ...cell,
      measurements,
    });
  }

  if (measuredCells.length === 0) {
    return null;
  }

  return {
    sourceKey,
    cells: measuredCells,
  };
}
