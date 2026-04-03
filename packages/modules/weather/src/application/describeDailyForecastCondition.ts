export function describeDailyForecastCondition(input: {
  airTemperatureMinC: number | null;
  precipitationMm: number;
  windSpeedKph: number | null;
}): string {
  const minT = input.airTemperatureMinC;
  const precip = input.precipitationMm;
  const wind = input.windSpeedKph ?? 0;

  if (minT !== null && minT <= -10) return precip >= 2 ? "Snow likely" : "Deep frost";
  if (minT !== null && minT <= 0) return precip >= 2 ? "Rain/snow mix" : "Frost risk";
  if (precip >= 10) return "Heavy rain";
  if (precip >= 2) return "Light rain";
  if (wind >= 40) return "High wind";
  if (precip > 0) return "Chance of showers";
  return "Dry";
}
