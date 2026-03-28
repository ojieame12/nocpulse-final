import type { LldMeridian } from "../../contracts/LldComponents";

export const SECTION_WIDTH_M = 1_609.344;
export const QUARTER_WIDTH_M = SECTION_WIDTH_M / 2;
export const QUARTER_AREA_HA = (QUARTER_WIDTH_M * QUARTER_WIDTH_M) / 10_000;

export const MERIDIAN_BASES: Record<
  `W${LldMeridian}`,
  {
    lat: number;
    lng: number;
  }
> = {
  W1: { lat: 49.0, lng: -101.35 },
  W2: { lat: 49.0, lng: -105.0 },
  W3: { lat: 49.0, lng: -106.95 },
  W4: { lat: 49.0, lng: -110.0 },
  W5: { lat: 49.0, lng: -114.0 },
  W6: { lat: 49.0, lng: -118.0 },
};
