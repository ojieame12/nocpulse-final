import type { RasterComputationMode } from "../contracts/RasterArtifact";

export function describeRasterMode(mode: RasterComputationMode) {
  return `Raster computation mode: ${mode}`;
}
