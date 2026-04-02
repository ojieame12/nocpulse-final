export type SmapValidationExclusionReason =
  | "missing-nocpulse"
  | "missing-smap"
  | "bootstrap-snapshot"
  | "missing-snapshot-provenance"
  | "non-source-backed-snapshot";

export type SmapFieldTimeseriesPoint = {
  date: string;
  nocpulsePct: number | null;
  smapPct: number | null;
  scored: boolean;
  exclusionReason: SmapValidationExclusionReason | null;
  snapshotSourceKey: string | null;
  snapshotDerivationMode: string | null;
};

export type SmapFieldReport = {
  fieldId: string;
  fieldName: string;
  periodDays: number;
  matchedDates: number;
  rawMatchedDates: number;
  excludedMatchedDates: number;
  metrics: {
    rmse: number; // Root mean square error (volumetric %)
    mae: number; // Mean absolute error
    pearsonR: number; // Correlation coefficient
    bias: number; // Mean signed difference (NocPulse - SMAP)
  };
  timeseries: SmapFieldTimeseriesPoint[];
};

export type SmapBacktestReport = {
  generatedAt: string;
  periodDays: number;
  fields: SmapFieldReport[];
  summary: {
    totalFields: number;
    fieldsWithData: number;
    meanRmse: number;
    meanMae: number;
    meanPearsonR: number;
    meanBias: number;
  };
};
