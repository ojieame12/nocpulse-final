import type { FieldMoistureCellDerivationStrategy } from "../contracts/FieldMoistureCellDerivationStrategy";
import { generateSyntheticFieldMoistureCells } from "../domain/cells/generateSyntheticFieldMoistureCells";

type CreateSyntheticFieldMoistureCellDerivationStrategyOptions = {
  strategyKey?: string;
};

export function createSyntheticFieldMoistureCellDerivationStrategy({
  strategyKey = "synthetic-grid-v1",
}: CreateSyntheticFieldMoistureCellDerivationStrategyOptions = {}): FieldMoistureCellDerivationStrategy {
  return {
    deriveCells(input) {
      return {
        strategyKey,
        cells: generateSyntheticFieldMoistureCells({
          fieldId: input.fieldId,
          boundary: input.boundary,
          rootZonePct: input.snapshot.rootZonePct,
          surfacePct: input.snapshot.surfacePct,
        }),
      };
    },
  };
}
