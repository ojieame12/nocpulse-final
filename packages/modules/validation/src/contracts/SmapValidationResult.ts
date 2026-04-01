export type SmapFieldReport = {
  fieldId: string;
  fieldName: string;
  periodDays: number;
  matchedDates: number;
  metrics: {
    rmse: number; // Root mean square error (volumetric %)
    mae: number; // Mean absolute error
    pearsonR: number; // Correlation coefficient
    bias: number; // Mean signed difference (NocPulse - SMAP)
  };
  timeseries: Array<{
    date: string;
    nocpulsePct: number | null;
    smapPct: number | null;
  }>;
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
