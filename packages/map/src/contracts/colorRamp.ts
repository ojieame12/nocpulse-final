import type { MapRgbColor } from "../domain/render/FieldBoundaryPreviewRenderModel";
import type { FieldAgronomicSurfaceMetricKey } from "../domain/render/FieldAgronomicSurfaceRenderModel";

export type ColorRampStop = readonly [pct: number, color: MapRgbColor];
export type ColorRamp = readonly ColorRampStop[];

/**
 * NDVI — classic vegetation index ramp.
 *
 * Bare soil / stressed (0.0–0.2) → transitional (0.3–0.5) → healthy canopy (0.6–1.0).
 * Values are normalized 0–100 for consistency with the extrusion pipeline.
 */
const NDVI_RAMP: ColorRamp = [
  [0, [210, 48, 38]],       // bare / stressed — vivid red
  [20, [245, 108, 28]],     // sparse cover — bright orange
  [40, [250, 200, 32]],     // transitional — warm yellow
  [60, [56, 218, 108]],     // moderate canopy — vibrant green
  [80, [34, 185, 90]],      // healthy canopy — rich green
  [100, [28, 152, 72]],     // peak vigor — deep green
];

/**
 * NDRE — red-edge index ramp.
 *
 * More sensitive to chlorophyll content in dense canopies.
 * Range is narrower than NDVI; colors shifted toward blue-green
 * to visually distinguish it.
 */
const NDRE_RAMP: ColorRamp = [
  [0, [215, 72, 48]],       // low chlorophyll — warm red
  [20, [242, 158, 62]],     // sparse — bright amber
  [40, [218, 215, 68]],     // transitional — vivid chartreuse
  [60, [66, 198, 138]],     // moderate — bright emerald
  [80, [32, 172, 162]],     // healthy — vivid teal
  [100, [22, 138, 148]],    // peak — rich teal
];

/**
 * NDMI — moisture infrared index ramp.
 *
 * Tracks leaf water content via SWIR. Separate from soil moisture.
 */
const NDMI_RAMP: ColorRamp = [
  [0, [205, 88, 42]],       // dry canopy — bright burnt orange
  [20, [240, 178, 56]],     // low moisture — warm amber
  [40, [188, 212, 82]],     // moderate — vivid lime
  [60, [62, 192, 160]],     // adequate — bright teal
  [80, [32, 158, 198]],     // high moisture — vivid cerulean
  [100, [24, 118, 192]],    // saturated — rich blue
];

/**
 * Moisture — root-zone soil moisture ramp.
 *
 * Fixed agronomic scale for prairie cropland.
 * This is the existing ramp from buildFieldMoistureSurfaceRenderModel,
 * extracted here for reuse.
 */
const MOISTURE_RAMP: ColorRamp = [
  [0, [210, 48, 38]],       // dry — vivid red
  [25, [255, 132, 38]],     // stress onset — bright orange
  [50, [250, 200, 32]],     // field capacity — warm yellow
  [75, [56, 218, 108]],     // well-watered — vibrant green
  [100, [28, 186, 248]],    // saturated — bright sky blue
];

const RAMP_BY_METRIC: Record<FieldAgronomicSurfaceMetricKey, ColorRamp> = {
  ndvi: NDVI_RAMP,
  ndre: NDRE_RAMP,
  ndmi: NDMI_RAMP,
  "root-zone-moisture-pct": MOISTURE_RAMP,
  "surface-moisture-pct": MOISTURE_RAMP,
};

export function resolveColorRamp(
  metricKey: FieldAgronomicSurfaceMetricKey,
): ColorRamp {
  return RAMP_BY_METRIC[metricKey];
}

export {
  NDVI_RAMP,
  NDRE_RAMP,
  NDMI_RAMP,
  MOISTURE_RAMP,
};
