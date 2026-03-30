import {
  AmbientLight,
  DirectionalLight,
  LightingEffect,
  type Material,
  type PickingInfo,
} from "@deck.gl/core";
import { GeoJsonLayer, PathLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import { CellGradientExtension } from "./CellGradientExtension";
import { MapboxOverlay } from "@deck.gl/mapbox";
import maplibregl, {
  type LngLatBoundsLike,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import type {
  FieldBoundaryPreviewRenderModel,
  FieldBoundaryZoneRenderModel,
  MapGeoPoint,
} from "../../domain/render/FieldBoundaryPreviewRenderModel";
import type { FieldAgronomicCellRenderModel } from "../../domain/render/FieldAgronomicSurfaceRenderModel";
import type { CellHoverEvent, CellClickEvent } from "../../domain/interaction/CellInteractionEvent";
import type { MapRuntimeContract } from "./MapRuntimeContract";

/**
 * ESRI World Imagery — free satellite basemap, no API key needed.
 * Dark earth background makes colored cell extrusions clearly visible.
 */
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        "&copy; Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const DEFAULT_STYLE = SATELLITE_STYLE;

/** V1-style selected cell height lift (metres, before elevationScale). */
const SELECTED_LIFT_M = 6;

/** Target alpha for non-hovered cells when any cell is hovered.
 *  Subtle dim rather than dramatic — keeps the overall scene bright. */
const HOVER_DIM_TARGET_ALPHA = 130;

/** How fast hover dim fades in/out (0–1 per ms). */
const HOVER_DIM_RATE = 1 / 70; // 70ms to full dim — snappy response

/** Entrance animation duration (ms). Extrusions grow + colors fade in. */
const ENTRANCE_DURATION_MS = 400;

/** Slight overshoot for bounce-settle feel on entrance. */
const ENTRANCE_OVERSHOOT = 1.06;

/** How much non-hovered cells shrink when a cell is hovered (0 = flat, 1 = full). */
const HOVER_SQUASH_FLOOR = 0.3;

/** Hovered cell lifts slightly above its base height (metres). */
const HOVER_LIFT_M = 4;

function toBounds(bbox: FieldBoundaryPreviewRenderModel["bbox"]): LngLatBoundsLike {
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}

/** Ease-out cubic — fast start, smooth deceleration. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Clamp to [0, 1]. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Lerp between two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Interaction state ──────────────────────────────────────

type InteractionState = {
  hoveredCellId: string | null;
  selectedCellId: string | null;
  /** 0 → fully collapsed/transparent, 1 → fully visible. */
  entranceProgress: number;
  /** 0 → no dim, 1 → fully dimmed. Interpolated smoothly. */
  hoverDimProgress: number;
  /** Timestamp of last hover-dim tick (for delta-time interpolation). */
  hoverDimLastTick: number;
};

// ── Zone geometry helpers ─────────────────────────────────

/** Compute bounding box [west, south, east, north] for a set of cells. */
function computeCellsBbox(cells: FieldAgronomicCellRenderModel[]): [number, number, number, number] | null {
  if (cells.length === 0) return null;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const cell of cells) {
    for (const [lng, lat] of cell.polygon) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return [west, south, east, north];
}

function computeZoneBbox(
  zone: Pick<FieldBoundaryZoneRenderModel, "geometry">,
): [number, number, number, number] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const polygon of zone.geometry.coordinates) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (lng < west) west = lng;
        if (lng > east) east = lng;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
      }
    }
  }

  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return null;
  }

  return [west, south, east, north];
}

/** Build a convex hull outline from zone cells' polygons for the zone outline layer. */
function buildZoneOutlineRing(cells: FieldAgronomicCellRenderModel[]): MapGeoPoint[] {
  // Collect all vertices from the zone's cells
  const points: MapGeoPoint[] = [];
  for (const cell of cells) {
    for (const pt of cell.polygon) {
      points.push(pt);
    }
  }
  if (points.length < 3) return points;

  // Graham scan convex hull
  const anchor = points.reduce((best, p) =>
    p[1] < best[1] || (p[1] === best[1] && p[0] < best[0]) ? p : best,
  );

  const sorted = points
    .filter((p) => p !== anchor)
    .sort((a, b) => {
      const angleA = Math.atan2(a[1] - anchor[1], a[0] - anchor[0]);
      const angleB = Math.atan2(b[1] - anchor[1], b[0] - anchor[0]);
      if (angleA !== angleB) return angleA - angleB;
      const distA = (a[0] - anchor[0]) ** 2 + (a[1] - anchor[1]) ** 2;
      const distB = (b[0] - anchor[0]) ** 2 + (b[1] - anchor[1]) ** 2;
      return distA - distB;
    });

  const hull: MapGeoPoint[] = [anchor];

  for (const p of sorted) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      if (cross > 0) break;
      hull.pop();
    }
    hull.push(p);
  }

  // Close the ring
  hull.push(hull[0]);
  return hull;
}

function resolveZoneFillColor(
  zone: Pick<FieldBoundaryZoneRenderModel, "id" | "status">,
  focusedZoneId: string | null,
): [number, number, number, number] {
  if (zone.id === focusedZoneId) {
    return [245, 214, 98, 38];
  }

  if (zone.status === "resolved") {
    return [148, 163, 184, 8];
  }

  return [191, 219, 254, 12];
}

function resolveZoneLineColor(
  zone: Pick<FieldBoundaryZoneRenderModel, "id" | "status">,
  focusedZoneId: string | null,
): [number, number, number, number] {
  if (zone.id === focusedZoneId) {
    return [245, 214, 98, 214];
  }

  if (zone.status === "resolved") {
    return [148, 163, 184, 56];
  }

  return [191, 219, 254, 92];
}

// ── Layer factory ──────────────────────────────────────────

function createLayers(
  model: FieldBoundaryPreviewRenderModel,
  interaction: InteractionState,
  callbacks: {
    onCellHover: (info: PickingInfo) => void;
    onCellClick: (info: PickingInfo) => void;
    onFieldHover: (info: PickingInfo) => void;
    onFieldClick: (info: PickingInfo) => void;
  },
) {
  const palette = model.presentation.palette;
  const surface = model.agronomicSurface;
  const { hoveredCellId, selectedCellId, entranceProgress, hoverDimProgress } = interaction;
  const anyHovered = hoveredCellId !== null || hoverDimProgress > 0.005;
  const focusedZoneId = model.focusedZoneId ?? null;
  const anyZoneFocused = focusedZoneId !== null;
  const zoneFeatures =
    model.zones?.map((zone) => ({
      type: "Feature" as const,
      properties: {
        zoneId: zone.id,
        family: zone.family,
        status: zone.status,
        latestSeverity: zone.latestSeverity,
      },
      geometry: zone.geometry,
    })) ?? [];
  const contextFieldFeatures =
    model.workspaceFieldFeatures?.filter(
      (feature) => feature.properties.fieldId !== model.fieldId,
    ) ?? [];

  // Entrance: overshoot then settle → extrusions bounce up slightly past target
  const rawEntrance = entranceProgress;
  const overshootEntrance = rawEntrance < 1
    ? rawEntrance * ENTRANCE_OVERSHOOT
    : 1; // settle to exactly 1 after animation completes
  const animatedElevationScale = 4 * Math.min(overshootEntrance, 1.06);

  // Entrance-driven alpha multiplier: colors fade from 0 → 1
  const alphaMultiplier = Math.min(rawEntrance, 1);

  // Smooth hover dim: blend from full alpha → dim alpha based on hoverDimProgress
  const dimAlpha = lerp(255, HOVER_DIM_TARGET_ALPHA, hoverDimProgress);

  return [
    // ── 0. Workspace field context outlines (clickable) ──
    ...(contextFieldFeatures.length > 0
      ? [
          new GeoJsonLayer({
            id: `workspace-field-context-fill:${model.fieldId}`,
            data: contextFieldFeatures,
            filled: true,
            stroked: false,
            pickable: true,
            getFillColor: [14, 22, 18, 22] as [number, number, number, number],
            autoHighlight: true,
            highlightColor: [255, 255, 255, 28] as [number, number, number, number],
            onHover: callbacks.onFieldHover,
            onClick: callbacks.onFieldClick,
          }),
          new GeoJsonLayer({
            id: `workspace-field-context-hit:${model.fieldId}`,
            data: contextFieldFeatures,
            filled: false,
            stroked: true,
            pickable: true,
            lineWidthUnits: "pixels",
            lineWidthMinPixels: 10,
            lineWidthMaxPixels: 12,
            getLineColor: [255, 255, 255, 1] as [number, number, number, number],
            onHover: callbacks.onFieldHover,
            onClick: callbacks.onFieldClick,
          }),
          new GeoJsonLayer({
            id: `workspace-field-context-outline:${model.fieldId}`,
            data: contextFieldFeatures,
            filled: false,
            stroked: true,
            pickable: false,
            lineWidthUnits: "pixels",
            lineWidthMinPixels: 2,
            lineWidthMaxPixels: 4,
            getLineColor: [203, 213, 225, 108] as [number, number, number, number],
          }),
        ]
      : []),

    // ── 1. Field boundary fill (ground plane) ──
    new GeoJsonLayer({
      id: `field-boundary-fill:${model.fieldId}`,
      data: model.boundaryFeature,
      filled: true,
      stroked: true,
      pickable: false,
      lineWidthUnits: "pixels",
      lineWidthMinPixels: 2,
      getFillColor: palette.fillColor,
      getLineColor: palette.lineColor,
    }),

    // ── 3a. Ambient occlusion ground contact (V1-style) ──
    // Non-offset dark fill directly beneath cells — simulates AO
    // where extrusions meet the ground plane.
    ...(surface
      ? [
          new PolygonLayer({
            id: `${surface.id}:ao`,
            data: surface.cells,
            filled: true,
            stroked: false,
            pickable: false,
            extruded: false,
            getPolygon: (cell: FieldAgronomicCellRenderModel) => cell.polygon,
            getFillColor: () => {
              const alpha = Math.round(42 * alphaMultiplier);
              return [4, 8, 6, alpha] as [number, number, number, number];
            },
            updateTriggers: {
              getFillColor: [entranceProgress],
            },
          }),
        ]
      : []),

    // ── 3b. Directional drop shadow (offset opposite the sun) ──
    ...(surface
      ? (() => {
          const lightDir = model.presentation.lightingPreset.directionalDirection;
          const azRad = ((lightDir[0] + 180) * Math.PI) / 180;
          const shadowMagnitude = 0.000035; // slightly larger for drama
          const dLng = Math.cos(azRad) * shadowMagnitude;
          const dLat = Math.sin(azRad) * shadowMagnitude;

          return [
            new PolygonLayer({
              id: `${surface.id}:shadow`,
              data: surface.cells,
              filled: true,
              stroked: false,
              pickable: false,
              extruded: false,
              getPolygon: (cell: FieldAgronomicCellRenderModel) =>
                cell.polygon.map(([lng, lat]) => [lng + dLng, lat + dLat] as MapGeoPoint),
              getFillColor: (cell: FieldAgronomicCellRenderModel) => {
                const heightFactor = Math.pow(Math.min(cell.displayHeightM / 55, 1), 0.7);
                const alpha = Math.round((14 + heightFactor * 38) * alphaMultiplier);
                return [4, 8, 6, alpha] as [number, number, number, number];
              },
            }),
          ];
        })()
      : []),

    // ── 4. Main cell extrusion layer (interactive) ──
    ...(surface
      ? [
          new PolygonLayer({
            id: surface.id,
            data: surface.cells,
            filled: true,
            stroked: true,
            pickable: true,
            extruded: true,
            wireframe: false,
            elevationScale: animatedElevationScale,
            material: surface.material satisfies Material,
            extensions: [new CellGradientExtension()],

            // ── Geometry ──
            getPolygon: (cell: FieldAgronomicCellRenderModel) => cell.polygon,

            // ── Elevation: hover squash + selected lift ──
            getElevation: (cell: FieldAgronomicCellRenderModel) => {
              const base = surface.baseElevationM + cell.displayHeightM;

              if (cell.id === selectedCellId) {
                return base + SELECTED_LIFT_M;
              }

              if (anyHovered) {
                if (cell.id === hoveredCellId) {
                  // Hovered cell lifts slightly
                  return base + HOVER_LIFT_M * hoverDimProgress;
                }
                // Others squash down smoothly
                const squash = lerp(1, HOVER_SQUASH_FLOOR, hoverDimProgress);
                return (surface.baseElevationM + cell.displayHeightM * squash);
              }

              return base;
            },

            // ── Color: entrance fade-in + smooth hover dim + zone focus ──
            getFillColor: (cell: FieldAgronomicCellRenderModel) => {
              let alpha = cell.fillColor[3];
              let r = cell.fillColor[0];
              let g = cell.fillColor[1];
              let b = cell.fillColor[2];

              if (anyHovered) {
                // Hovered cell stays full brightness; others smoothly dim
                alpha = cell.id === hoveredCellId ? alpha : Math.round(dimAlpha);
              } else if (anyZoneFocused && cell.zoneId !== focusedZoneId) {
                alpha = 120;
              } else if (anyZoneFocused && cell.zoneId === focusedZoneId) {
                r = Math.min(r + 14, 255);
                g = Math.min(g + 14, 255);
                b = Math.min(b + 14, 255);
                alpha = 255;
              }

              // Entrance fade-in
              alpha = Math.round(alpha * alphaMultiplier);
              return [r, g, b, alpha] as [number, number, number, number];
            },

            getLineColor: (cell: FieldAgronomicCellRenderModel) => {
              let lc: [number, number, number, number];
              if (cell.id === selectedCellId) {
                lc = [255, 255, 255, 220];
              } else if (anyZoneFocused && cell.zoneId === focusedZoneId) {
                lc = [245, 214, 98, 255];
              } else {
                lc = [...cell.lineColor] as [number, number, number, number];
              }
              lc[3] = Math.round(lc[3] * alphaMultiplier);
              return lc;
            },

            lineWidthUnits: "pixels" as const,
            lineWidthMinPixels: 2,

            // ── Hover highlight (deck.gl native) ──
            autoHighlight: true,
            highlightColor: [255, 255, 255, 50],

            // ── Callbacks ──
            onHover: callbacks.onCellHover,
            onClick: callbacks.onCellClick,

            // ── Smooth transitions — kept short to prevent ghost extrusions
            //    when hopping between cells quickly ──
            transitions: {
              getElevation: { duration: 80, easing: easeOutCubic },
              getFillColor: { duration: 60 },
              getLineColor: { duration: 60 },
            },

            // ── Update triggers ──
            updateTriggers: {
              getFillColor: [surface.id, hoveredCellId, focusedZoneId, entranceProgress, hoverDimProgress],
              getLineColor: [surface.id, selectedCellId, focusedZoneId, entranceProgress, hoverDimProgress],
              getElevation: [surface.id, selectedCellId, hoveredCellId, hoverDimProgress],
            },
          }),
        ]
      : []),

    // ── 5. Selected cell outline ring ──
    ...(surface && selectedCellId
      ? (() => {
          const selectedCell = surface.cells.find((c) => c.id === selectedCellId);
          return selectedCell
            ? [
                new PathLayer({
                  id: `${surface.id}:selection-ring`,
                  data: [selectedCell],
                  pickable: false,
                  widthUnits: "pixels",
                  widthMinPixels: 2,
                  widthMaxPixels: 4,
                  getPath: (cell: FieldAgronomicCellRenderModel) => cell.polygon,
                  getColor: [255, 255, 255, 200] as [number, number, number, number],
                  getWidth: 3,
                }),
              ]
            : [];
        })()
      : []),

    // ── 6. Tracked zone footprints (real persisted zone geometry) ──
    ...(zoneFeatures.length > 0
      ? [
          new GeoJsonLayer({
            id: `field-zone-footprints:${model.fieldId}`,
            data: zoneFeatures,
            filled: true,
            stroked: true,
            pickable: false,
            lineWidthUnits: "pixels",
            lineWidthMinPixels: 2,
            getFillColor: (feature: {
              properties?: {
                zoneId?: string;
                status?: string;
              };
            }) =>
              resolveZoneFillColor(
                {
                  id: feature.properties?.zoneId ?? "",
                  status: feature.properties?.status ?? "new",
                },
                focusedZoneId,
              ),
            getLineColor: (feature: {
              properties?: {
                zoneId?: string;
                status?: string;
              };
            }) =>
              resolveZoneLineColor(
                {
                  id: feature.properties?.zoneId ?? "",
                  status: feature.properties?.status ?? "new",
                },
                focusedZoneId,
              ),
            getLineWidth: (feature: {
              properties?: {
                zoneId?: string;
              };
            }) => (feature.properties?.zoneId === focusedZoneId ? 3 : 2),
          }),
        ]
      : []),

    // ── 7. Focused zone outline fallback (for cell-linked zones without persisted geometry) ──
    ...(surface && anyZoneFocused && !zoneFeatures.some((feature) => feature.properties.zoneId === focusedZoneId)
      ? (() => {
          const zoneCells = surface.cells.filter((c) => c.zoneId === focusedZoneId);
          if (zoneCells.length < 2) return [];
          const outline = buildZoneOutlineRing(zoneCells);
          if (outline.length < 3) return [];
          return [
            // Soft glow underneath
            new PathLayer({
              id: `${surface.id}:zone-glow`,
              data: [{ path: outline }],
              pickable: false,
              widthUnits: "pixels",
              widthMinPixels: 6,
              widthMaxPixels: 12,
              getPath: (d: { path: MapGeoPoint[] }) => d.path,
              getColor: [245, 214, 98, 40] as [number, number, number, number],
              getWidth: 10,
            }),
            // Crisp dashed line on top
            new PathLayer({
              id: `${surface.id}:zone-outline`,
              data: [{ path: outline }],
              pickable: false,
              widthUnits: "pixels",
              widthMinPixels: 2,
              widthMaxPixels: 4,
              getPath: (d: { path: MapGeoPoint[] }) => d.path,
              getColor: [245, 214, 98, 200] as [number, number, number, number],
              getWidth: 2.5,
              getDashArray: [8, 4],
              dashJustified: true,
              extensions: [new PathStyleExtension({ dash: true })],
            }),
          ];
        })()
      : []),

    // ── 8a. Soft-edge glow (wide, faint fill-tinted outline blends cell seams) ──
    ...(surface
      ? [
          new PathLayer({
            id: `${surface.id}:soft-edge`,
            data: surface.cells,
            pickable: false,
            widthUnits: "pixels",
            widthMinPixels: 3,
            widthMaxPixels: 6,
            getPath: (cell: FieldAgronomicCellRenderModel) => cell.polygon,
            getColor: (cell: FieldAgronomicCellRenderModel) => {
              const [r, g, b] = cell.fillColor;
              const a = Math.round(22 * alphaMultiplier);
              return [
                Math.round(r * 0.35),
                Math.round(g * 0.35),
                Math.round(b * 0.35),
                a,
              ] as [number, number, number, number];
            },
            getWidth: 5,
          }),
        ]
      : []),

    // ── 8b. Rim highlight (top-edge catch light — softened) ──
    ...(surface
      ? [
          new PathLayer({
            id: `${surface.id}:rim`,
            data: surface.cells,
            pickable: false,
            widthUnits: "pixels",
            widthMinPixels: 1,
            widthMaxPixels: 2,
            getPath: (cell: FieldAgronomicCellRenderModel) => cell.polygon,
            getColor: [255, 255, 245, Math.round(32 * alphaMultiplier)] as [number, number, number, number],
            getWidth: 1.5,
          }),
        ]
      : []),

    // ── 9. Field label dot ──
    new ScatterplotLayer({
      id: `field-boundary-label:${model.fieldId}`,
      data: [{ position: model.labelPoint }],
      pickable: false,
      radiusUnits: "pixels",
      radiusMinPixels: 5,
      radiusMaxPixels: 8,
      getRadius: 6,
      getLineColor: palette.labelLineColor,
      getFillColor: palette.labelFillColor,
      stroked: true,
      filled: true,
      lineWidthMinPixels: 2,
      getPosition: (entry: { position: FieldBoundaryPreviewRenderModel["labelPoint"] }) =>
        entry.position,
    }),
  ];
}

// ── Lighting ───────────────────────────────────────────────

function toDirectionalVector(
  [azimuthDegrees, altitudeDegrees]: readonly [number, number],
): [number, number, number] {
  const azimuthRadians = (azimuthDegrees * Math.PI) / 180;
  const altitudeRadians = (altitudeDegrees * Math.PI) / 180;
  const horizontalMagnitude = Math.cos(altitudeRadians);

  return [
    Math.cos(azimuthRadians) * horizontalMagnitude,
    Math.sin(azimuthRadians) * horizontalMagnitude,
    -Math.sin(altitudeRadians),
  ];
}

function createEffects(model: FieldBoundaryPreviewRenderModel) {
  const lighting = model.presentation.lightingPreset;

  const ambientLight = new AmbientLight({
    color: [255, 255, 255],
    intensity: lighting.ambientIntensity,
  });

  // Single strong sun — V1 style. No fill light;
  // shadows go dark which makes the lit faces vivid.
  const keyLight = new DirectionalLight({
    color: [255, 255, 255],
    intensity: lighting.directionalIntensity,
    direction: toDirectionalVector(lighting.directionalDirection),
  });

  return [new LightingEffect({ ambientLight, keyLight })];
}

// ── Runtime factory ────────────────────────────────────────

export type CreateFieldBoundaryPreviewRuntimeOptions = {
  style?: StyleSpecification;
  onCellHover?: (event: CellHoverEvent | null) => void;
  onCellClick?: (event: CellClickEvent) => void;
  onFieldHover?: (fieldId: string | null) => void;
  onFieldClick?: (fieldId: string) => void;
  onFatalError?: (error: Error) => void;
};

export function createFieldBoundaryPreviewRuntime({
  style = DEFAULT_STYLE,
  onCellHover,
  onCellClick,
  onFieldHover,
  onFieldClick,
  onFatalError,
}: CreateFieldBoundaryPreviewRuntimeOptions = {}): MapRuntimeContract<FieldBoundaryPreviewRenderModel> {
  let map: MapLibreMap | null = null;
  let overlay: MapboxOverlay | null = null;
  let mountedContainer: HTMLElement | null = null;
  let currentModel: FieldBoundaryPreviewRenderModel | null = null;

  // Mutable interaction state — changing this triggers a layer rebuild.
  const interaction: InteractionState = {
    hoveredCellId: null,
    selectedCellId: null,
    entranceProgress: 0,
    hoverDimProgress: 0,
    hoverDimLastTick: 0,
  };

  /** Active entrance animation frame handle (0 = none running). */
  let entranceRafId = 0;

  /** Active hover-dim animation frame handle (0 = none running). */
  let hoverDimRafId = 0;

  /** Hover-out debounce timer — prevents flicker when moving between cells. */
  let hoverOutTimer: ReturnType<typeof setTimeout> | null = null;
  /** Short delay — clear quickly when cursor leaves a cell but long enough
   *  to avoid flicker when moving between adjacent cells. */
  const HOVER_OUT_DELAY_MS = 120;

  function assertMounted() {
    if (!map || !overlay) {
      throw new Error("[map] field boundary runtime is not mounted");
    }
    return { map, overlay };
  }

  // ── Hover dim animation loop ──

  function startHoverDimLoop() {
    if (hoverDimRafId) return; // already running
    interaction.hoverDimLastTick = performance.now();

    function tickHoverDim(now: number) {
      const dt = now - interaction.hoverDimLastTick;
      interaction.hoverDimLastTick = now;

      const target = interaction.hoveredCellId !== null ? 1 : 0;
      const step = dt * HOVER_DIM_RATE;
      const prev = interaction.hoverDimProgress;

      if (target > prev) {
        interaction.hoverDimProgress = Math.min(prev + step, 1);
      } else {
        interaction.hoverDimProgress = Math.max(prev - step, 0);
      }

      // Only rebuild when the change is visually meaningful (> ~1 alpha unit)
      const delta = Math.abs(interaction.hoverDimProgress - prev);
      if (delta > 0.004) {
        rebuildLayers();
      }

      // Keep looping until we've settled at the target
      const settled = Math.abs(interaction.hoverDimProgress - target) < 0.005;
      if (!settled) {
        hoverDimRafId = requestAnimationFrame(tickHoverDim);
      } else {
        interaction.hoverDimProgress = target;
        hoverDimRafId = 0;
        rebuildLayers();
      }
    }

    hoverDimRafId = requestAnimationFrame(tickHoverDim);
  }

  // ── Interaction callbacks (called by deck.gl layers) ──

  function handleCellHover(info: PickingInfo) {
    const cell = info.object as FieldAgronomicCellRenderModel | undefined;
    const metricKey = currentModel?.agronomicSurface?.metricKey;

    if (cell && metricKey) {
      // Cancel any pending hover-out — cursor is still on the field
      if (hoverOutTimer !== null) {
        clearTimeout(hoverOutTimer);
        hoverOutTimer = null;
      }

      const changed = interaction.hoveredCellId !== cell.id;
      interaction.hoveredCellId = cell.id;

      if (changed) {
        if (interaction.hoverDimProgress < 0.01) {
          // First cell hovered — kick off the squash animation
          startHoverDimLoop();
        } else {
          // Moving between cells — just swap the lift target,
          // deck.gl transitions handle the smooth elevation change.
          rebuildLayers();
        }
      }

      onCellHover?.({
        cellId: cell.id,
        metricKey,
        metricValuePct: cell.metricValuePct,
        displayHeightM: cell.displayHeightM,
        screenX: info.x,
        screenY: info.y,
        confidence: cell.confidence,
        sourceTier: cell.sourceTier,
        deltaFromFieldAvgPct: cell.deltaFromFieldAvgPct,
        percentileInField: cell.percentileInField,
        anomalyClass: cell.anomalyClass,
        varianceBucket: cell.varianceBucket,
        severityLabel: cell.severityLabel,
        zoneId: cell.zoneId,
      });
    } else {
      // Debounce hover-out: wait a beat before committing to null
      // so moving between adjacent cells doesn't cause a snap-up flicker.
      if (interaction.hoveredCellId !== null && hoverOutTimer === null) {
        hoverOutTimer = setTimeout(() => {
          hoverOutTimer = null;
          interaction.hoveredCellId = null;
          startHoverDimLoop();
          onCellHover?.(null);
        }, HOVER_OUT_DELAY_MS);
      }
    }
  }

  function handleCellClick(info: PickingInfo) {
    const cell = info.object as FieldAgronomicCellRenderModel | undefined;
    const metricKey = currentModel?.agronomicSurface?.metricKey;

    if (cell && metricKey) {
      // Toggle: clicking the same cell deselects it.
      const newSelected = interaction.selectedCellId === cell.id ? null : cell.id;
      interaction.selectedCellId = newSelected;
      rebuildLayers();

      onCellClick?.({
        cellId: cell.id,
        metricKey,
        metricValuePct: cell.metricValuePct,
        displayHeightM: cell.displayHeightM,
        selected: newSelected !== null,
        screenX: info.x ?? 0,
        screenY: info.y ?? 0,
        // Analytics context
        confidence: cell.confidence,
        sourceTier: cell.sourceTier,
        deltaFromFieldAvgPct: cell.deltaFromFieldAvgPct,
        percentileInField: cell.percentileInField,
        anomalyClass: cell.anomalyClass,
        varianceBucket: cell.varianceBucket,
        severityLabel: cell.severityLabel,
        zoneId: cell.zoneId,
      });
    }
  }

  function handleFieldClick(info: PickingInfo) {
    const feature = info.object as
      | {
          properties?: {
            fieldId?: string;
          };
        }
      | undefined;
    const fieldId = feature?.properties?.fieldId;

    if (typeof fieldId === "string" && fieldId.length > 0) {
      onFieldClick?.(fieldId);
    }
  }

  function handleFieldHover(info: PickingInfo) {
    const feature = info.object as
      | {
          properties?: {
            fieldId?: string;
          };
        }
      | undefined;
    const fieldId = feature?.properties?.fieldId;
    onFieldHover?.(typeof fieldId === "string" && fieldId.length > 0 ? fieldId : null);
  }

  const layerCallbacks = {
    onCellHover: handleCellHover,
    onCellClick: handleCellClick,
    onFieldHover: handleFieldHover,
    onFieldClick: handleFieldClick,
  };

  // ── Layer rebuild (no camera change) ──

  function rebuildLayers() {
    if (!overlay || !currentModel) return;
    overlay.setProps({
      layers: createLayers(currentModel, interaction, layerCallbacks),
    });
  }

  // ── Full render (layers + camera) ──

  let isFirstRender = true;

  async function renderModel(model: FieldBoundaryPreviewRenderModel) {
    const mounted = assertMounted();
    const previousModel = currentModel;
    currentModel = model;

    const previousSurfaceId = previousModel?.agronomicSurface?.id ?? null;
    const nextSurfaceId = model.agronomicSurface?.id ?? null;
    const shouldResetSelection =
      !previousModel ||
      previousModel.fieldId !== model.fieldId ||
      previousSurfaceId !== nextSurfaceId;

    if (shouldResetSelection) {
      interaction.selectedCellId = null;
      interaction.hoveredCellId = null;
      if (hoverOutTimer !== null) {
        clearTimeout(hoverOutTimer);
        hoverOutTimer = null;
      }
    }

    // Decide camera target: zone bbox if a zone just got focused, else full field bbox.
    const previousFocusedZoneId = previousModel?.focusedZoneId ?? null;
    const nextFocusedZoneId = model.focusedZoneId ?? null;
    const zoneFocusChanged = nextFocusedZoneId !== previousFocusedZoneId;
    const fieldChanged = !previousModel || previousModel.fieldId !== model.fieldId;

    let targetBbox = model.bbox;
    let targetPadding = model.presentation.camera.paddingPx;

    if (zoneFocusChanged && nextFocusedZoneId) {
      const persistedZone = model.zones?.find((zone) => zone.id === nextFocusedZoneId) ?? null;
      const persistedZoneBbox = persistedZone ? computeZoneBbox(persistedZone) : null;
      const cellZoneBbox = model.agronomicSurface
        ? computeCellsBbox(
            model.agronomicSurface.cells.filter(
              (c) => c.zoneId === nextFocusedZoneId,
            ),
          )
        : null;
      const zoneBbox = persistedZoneBbox ?? cellZoneBbox;

      if (zoneBbox) {
        targetBbox = zoneBbox;
        targetPadding = Math.max(targetPadding, 80);
      }
    }

    // ── Camera: fly on first render, field switch, or zone focus change ──
    if (isFirstRender || fieldChanged || zoneFocusChanged) {
      // Distance-adaptive duration: farther jumps get more time to feel smooth
      let flyDuration = 0;
      if (!isFirstRender && previousModel) {
        const prevCenter = [
          (previousModel.bbox[0] + previousModel.bbox[2]) / 2,
          (previousModel.bbox[1] + previousModel.bbox[3]) / 2,
        ];
        const nextCenter = [
          (targetBbox[0] + targetBbox[2]) / 2,
          (targetBbox[1] + targetBbox[3]) / 2,
        ];
        const dist = Math.sqrt(
          (nextCenter[0] - prevCenter[0]) ** 2 + (nextCenter[1] - prevCenter[1]) ** 2,
        );
        // ~400ms for nearby fields, up to 900ms for cross-region jumps
        flyDuration = Math.min(350 + dist * 3000, 900);
      }

      mounted.map.fitBounds(toBounds(targetBbox), {
        padding: targetPadding,
        duration: flyDuration,
        maxZoom: model.presentation.camera.maxZoom,
        bearing: model.presentation.camera.bearing,
        pitch: model.presentation.camera.pitch,
      });
    }

    // ── Entrance animation: extrusions grow + colors fade in ──
    const shouldAnimate = isFirstRender || fieldChanged;

    if (shouldAnimate && model.agronomicSurface) {
      // Cancel any running entrance animation
      if (entranceRafId) {
        cancelAnimationFrame(entranceRafId);
        entranceRafId = 0;
      }

      interaction.entranceProgress = 0;
      // Push effects immediately (lighting doesn't change per frame)
      mounted.overlay.setProps({
        layers: createLayers(model, interaction, layerCallbacks),
        effects: createEffects(model),
      });
      const startTime = performance.now();

      function animateEntrance(now: number) {
        const elapsed = now - startTime;
        const raw = Math.min(elapsed / ENTRANCE_DURATION_MS, 1);
        interaction.entranceProgress = easeOutCubic(raw);
        rebuildLayers();

        if (raw < 1) {
          entranceRafId = requestAnimationFrame(animateEntrance);
        } else {
          interaction.entranceProgress = 1;
          entranceRafId = 0;
          rebuildLayers();
        }
      }

      // Start after a micro-delay so the camera fly begins first
      entranceRafId = requestAnimationFrame(animateEntrance);
    } else {
      // No animation needed — show full state immediately
      interaction.entranceProgress = 1;
      mounted.overlay.setProps({
        layers: createLayers(model, interaction, layerCallbacks),
        effects: createEffects(model),
      });
    }

    isFirstRender = false;
  }

  return {
    async mount(container, model) {
      if (map || overlay) {
        throw new Error("[map] field boundary runtime mount called twice");
      }

      mountedContainer = container;
      mountedContainer.replaceChildren();

      map = new maplibregl.Map({
        container,
        style,
        attributionControl: false,
        dragRotate: true,
        pitchWithRotate: true,
        touchPitch: true,
        keyboard: true,
        maxPitch: 72,
      });

      map.on("webglcontextlost", () => {
        onFatalError?.(new Error("MapLibre WebGL context lost. The browser exhausted GPU memory resources."));
      });

      currentModel = model;

      overlay = new MapboxOverlay({
        interleaved: false,
        layers: createLayers(model, interaction, layerCallbacks),
        effects: createEffects(model),
      });

      map.addControl(overlay);

      map.once("load", () => {
        // Atmosphere fog for depth — subtle haze at distance.
        // setFog may not be in all MapLibre type defs, so access via any.
        try {
          const mapAny = map as unknown as Record<string, unknown>;
          if (typeof mapAny["setFog"] === "function") {
            (mapAny["setFog"] as (fog: Record<string, unknown>) => void)({
              range: [2, 12],
              color: "rgba(240, 246, 243, 0.9)",
              "high-color": "rgba(250, 252, 251, 0.8)",
              "horizon-blend": 0.04,
              "star-intensity": 0,
            });
          }
        } catch {
          // setFog may not be available in all MapLibre versions
        }

        void renderModel(model);
      });
    },

    async update(model) {
      await renderModel(model);
    },

    async unmount() {
      // Cancel any running animations
      if (entranceRafId) {
        cancelAnimationFrame(entranceRafId);
        entranceRafId = 0;
      }
      if (hoverDimRafId) {
        cancelAnimationFrame(hoverDimRafId);
        hoverDimRafId = 0;
      }
      if (hoverOutTimer !== null) {
        clearTimeout(hoverOutTimer);
        hoverOutTimer = null;
      }

      if (map && overlay) {
        map.removeControl(overlay);
      }

      map?.remove();
      map = null;
      overlay = null;
      currentModel = null;
      mountedContainer?.replaceChildren();
      mountedContainer = null;
    },
  };
}
