export type MapLightingPresetId =
  | "flat-day"
  | "relief-review"
  | "low-sun-inspection"
  | "report-export";

export type MapLightingPreset = {
  id: MapLightingPresetId;
  ambientIntensity: number;
  directionalIntensity: number;
  directionalDirection: [number, number];
  /** Camera bearing (degrees). Decoupled from sun azimuth for side-lighting. */
  cameraBearing: number;
  description: string;
};

export const MAP_LIGHTING_PRESETS: readonly MapLightingPreset[] = [
  {
    id: "flat-day",
    ambientIntensity: 0.30,
    directionalIntensity: 0.80,
    directionalDirection: [210, 55],
    cameraBearing: 210,
    description: "Balanced daytime preset for general field review.",
  },
  {
    id: "relief-review",
    ambientIntensity: 0.15,
    directionalIntensity: 1.20,
    directionalDirection: [250, 55],
    cameraBearing: 210,
    description: "Vivid — high-energy sun so cell tops match ramp color.",
  },
  {
    id: "low-sun-inspection",
    ambientIntensity: 0.10,
    directionalIntensity: 1.30,
    directionalDirection: [260, 35],
    cameraBearing: 220,
    description: "Dramatic side-lit shading for inspection workflows.",
  },
  {
    id: "report-export",
    ambientIntensity: 0.30,
    directionalIntensity: 0.80,
    directionalDirection: [200, 55],
    cameraBearing: 200,
    description: "Stable preset for screenshots and exported artifacts.",
  },
] as const;

export const DEFAULT_MAP_LIGHTING_PRESET = MAP_LIGHTING_PRESETS[1];
