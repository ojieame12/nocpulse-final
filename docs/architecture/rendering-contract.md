# Rendering Contract

The rendering stack exists to solve one problem reliably: agronomic data
extrusions with stable lighting, shading, and interaction.

## Responsibilities

- `MapLibre` provides basemap, terrain, labels, and camera context.
- `deck.gl` provides probe cells, hotspots, picking, and extrusions.
- `packages/map` is the only place allowed to touch raw map runtime APIs.

## Guardrails

- Probe cells are never rendered through basemap extrusion layers.
- Hover and selection are app state, not engine-specific feature-state.
- Terrain is visual context and must not drive per-hover extrusion recompute.
- Lighting presets are explicit contracts, not scattered runtime mutations.
- Extrusions render from stable field-local base elevation plus display height.

## Testing expectations

- screenshot regression matrix for lighting presets
- field switch stability
- hover and selection picking
- steep slope and terrain edge cases
- export and report visual parity
