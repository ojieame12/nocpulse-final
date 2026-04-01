export type PerDepthSoilProperties = {
  /** Field capacity keyed by depth range, e.g. "0-5cm" → volumetric % */
  fc: Record<string, number | null>;
  /** Wilting point keyed by depth range */
  wp: Record<string, number | null>;
  /** Depth-weighted field capacity for 0-30cm, vol% */
  aggregateFcPct: number | null;
  /** Depth-weighted wilting point for 0-30cm, vol% */
  aggregateWpPct: number | null;
  /** Which transport was used */
  providerPath: "wcs" | "webdav" | "rest";
  /** Quantile or statistic used */
  samplingMethod: string;
  /** Number of valid pixels used in the mean */
  pixelCount: number;
};

export interface SoilPropertiesProvider {
  query(lat: number, lng: number): Promise<PerDepthSoilProperties | null>;
}
