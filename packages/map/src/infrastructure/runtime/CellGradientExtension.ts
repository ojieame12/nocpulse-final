import { LayerExtension } from "@deck.gl/core";

/**
 * deck.gl LayerExtension that paints a vertical colour gradient on extruded
 * polygon side-walls.
 *
 * ─ Top face keeps the original ramp colour at full brightness.
 * ─ Side-walls fade from a warm, darkened tint at the base to the full ramp
 *   colour at the crown, with a subtle highlight at the very top edge.
 *
 * Implementation:
 *   The SolidPolygonLayer compiles two separate vertex shaders — one for the
 *   top face and one for the side walls.  The side shader defines
 *   `IS_SIDE_VERTEX` and exposes a `positions` vec2 whose `.y` component is
 *   0 at the bottom of a wall and 1 at the top.  We pass that as a varying
 *   to the fragment shader and use it to blend brightness + colour temperature.
 */
export class CellGradientExtension extends LayerExtension {
  static override extensionName = "CellGradientExtension";

  override getShaders() {
    return {
      inject: {
        /* ─── Vertex shader ─── */

        "vs:#decl": /* glsl */ `
          out float cellGrad_heightFrac;
        `,

        "vs:#main-end": /* glsl */ `
          #ifdef IS_SIDE_VERTEX
            cellGrad_heightFrac = positions.y;
          #else
            cellGrad_heightFrac = 1.0;
          #endif
        `,

        /* ─── Fragment shader ─── */

        "fs:#decl": /* glsl */ `
          in float cellGrad_heightFrac;
        `,

        "fs:DECKGL_FILTER_COLOR": /* glsl */ `
          // ── Vertical brightness ramp ──
          // smoothstep gives a natural ease-in from dark base to bright crown.
          float cellGrad_t = smoothstep(0.0, 1.0, cellGrad_heightFrac);

          // Base brightness 48 % → 100 % at crown.
          float cellGrad_bright = mix(0.48, 1.0, cellGrad_t);
          color.rgb *= cellGrad_bright;

          // ── Warm tint at base (subtle amber / earth tone) ──
          float cellGrad_warmth = (1.0 - cellGrad_t) * 0.06;
          color.r = min(color.r + cellGrad_warmth, 1.0);
          color.g = min(color.g + cellGrad_warmth * 0.35, 1.0);

          // ── Crown highlight: a tiny additive bloom right at the top edge ──
          float cellGrad_crown = smoothstep(0.82, 1.0, cellGrad_heightFrac);
          color.rgb = min(color.rgb + vec3(cellGrad_crown * 0.035), vec3(1.0));
        `,
      },
    };
  }
}
