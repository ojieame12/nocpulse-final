export type MapTerrainContextMode = "flat" | "contextual-relief";

export type MapTerrainContext = {
  mode: MapTerrainContextMode;
  exaggeration: number;
  description: string;
};

export const MAP_TERRAIN_CONTEXTS: Record<MapTerrainContextMode, MapTerrainContext> = {
  flat: {
    mode: "flat",
    exaggeration: 0,
    description: "Flat review mode with no terrain exaggeration.",
  },
  "contextual-relief": {
    mode: "contextual-relief",
    exaggeration: 1.2,
    description: "Contextual terrain mode for reliable relief and extrusion review.",
  },
};
