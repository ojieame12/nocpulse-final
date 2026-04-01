export type SoilProperties = {
  fieldCapacityPct: number; // wv0033 mean, 0-100
  wiltingPointPct: number; // wv1500 mean, 0-100
  depthCm: string; // "0-30cm"
  source: "soilgrids-v2";
};
