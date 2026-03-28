export const MAP_RENDERING_GUARDRAILS = [
  "Probe cells render in deck.gl, not basemap fill-extrusion layers.",
  "Extrusions use stable field-local base elevation plus display height plus epsilon.",
  "Hover and selection are app state, not map-engine feature-state.",
  "Lighting presets are explicit data contracts, not improvised runtime mutations.",
  "Terrain is visual context; terrain refreshes must not reinitialize agronomic extrusions.",
] as const;
