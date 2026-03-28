import type { GrainPriceSnapshot } from "../contracts/GrainPriceSnapshot";

export function describeGrainPriceSnapshot(input: GrainPriceSnapshot) {
  return `${input.cropSymbol} ${input.closePriceCadPerTonne.toFixed(1)} CAD/t captured ${input.capturedAt}`;
}
