export type HistoricalSoilMoistureResult = {
  dailyValues: Array<{
    date: string;
    layers: Record<string, number | null>;
  }>;
  latitude: number;
  longitude: number;
};
