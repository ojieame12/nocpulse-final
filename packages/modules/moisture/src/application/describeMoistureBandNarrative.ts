export function describeMoistureBandNarrative(rootZonePct: number | null): string {
  if (rootZonePct === null) return "Insufficient data.";
  if (rootZonePct < 20) return "Root zone critically dry. Irrigation urgent.";
  if (rootZonePct < 30) return "Below optimal. Monitor for stress signs.";
  if (rootZonePct > 80) return "Saturated. Risk of waterlogging.";
  return "Within acceptable range for most crops.";
}
