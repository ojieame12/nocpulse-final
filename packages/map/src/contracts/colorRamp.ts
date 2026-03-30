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
  [0, [126, 92, 60]],       // bare / dormant ground — earthy umber
  [20, [184, 140, 72]],     // sparse cover — dry straw
  [40, [226, 196, 96]],     // transitional — warm yellow
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
  [0, [132, 98, 74]],       // low canopy/red-edge presence — earthy taupe
  [20, [190, 150, 86]],     // sparse — warm ochre
  [40, [214, 194, 92]],     // transitional — muted chartreuse
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
  [0, [154, 108, 68]],      // dry canopy — muted earth
  [20, [206, 164, 92]],     // low moisture — warm amber
  [40, [188, 204, 104]],    // moderate — muted lime
  [60, [62, 192, 160]],     // adequate — bright teal
  [80, [32, 158, 198]],     // high moisture — vivid cerulean
  [100, [24, 118, 192]],    // saturated — rich blue
];

/**
 * Radar Wetness — SAR-derived wetness proxy ramp.
 *
 * Separate from optical NDMI. Uses a more muted soil-to-water palette so
 * SAR-backed wetness does not masquerade as canopy-water content.
 */
const RADAR_WETNESS_RAMP: ColorRamp = [
  [0, [120, 92, 68]],       // dry radar return — earthy brown
  [20, [164, 128, 90]],     // drier mix — muted tan
  [40, [170, 168, 112]],    // mixed return — khaki
  [60, [98, 164, 150]],     // wetter pockets — muted teal
  [80, [58, 138, 176]],     // strong wetness — steel cyan
  [100, [34, 104, 162]],    // saturated return — deep slate blue
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
  "radar-wetness": RADAR_WETNESS_RAMP,
  "root-zone-moisture-pct": MOISTURE_RAMP,
  "surface-moisture-pct": MOISTURE_RAMP,
};

export function resolveColorRamp(
  metricKey: FieldAgronomicSurfaceMetricKey,
): ColorRamp {
  return RAMP_BY_METRIC[metricKey];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function boostSaturation(
  [r, g, b]: MapRgbColor,
  factor: number,
): MapRgbColor {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return [
    clamp(Math.round(lum + (r - lum) * factor), 0, 255),
    clamp(Math.round(lum + (g - lum) * factor), 0, 255),
    clamp(Math.round(lum + (b - lum) * factor), 0, 255),
  ];
}

export function resolveRampColor(
  metricKey: FieldAgronomicSurfaceMetricKey,
  valuePct: number,
): MapRgbColor {
  const stops = resolveColorRamp(metricKey);
  const clamped = clamp(valuePct, 0, 100);

  for (let index = 0; index < stops.length - 1; index += 1) {
    const [startPct, startColor] = stops[index];
    const [endPct, endColor] = stops[index + 1];

    if (clamped <= endPct) {
      const range = endPct - startPct || 1;
      const weight = (clamped - startPct) / range;

      const raw: MapRgbColor = [
        Math.round(startColor[0] + (endColor[0] - startColor[0]) * weight),
        Math.round(startColor[1] + (endColor[1] - startColor[1]) * weight),
        Math.round(startColor[2] + (endColor[2] - startColor[2]) * weight),
      ];

      const midness = 1 - Math.abs(weight - 0.5) * 2;
      const boost = 1 + midness * 0.35;
      return boostSaturation(raw, boost);
    }
  }

  return [...stops[stops.length - 1][1]];
}

export {
  NDVI_RAMP,
  NDRE_RAMP,
  NDMI_RAMP,
  RADAR_WETNESS_RAMP,
  MOISTURE_RAMP,
};
