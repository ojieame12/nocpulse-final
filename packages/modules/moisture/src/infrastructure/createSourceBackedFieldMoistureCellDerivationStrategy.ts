import type { FieldMoistureCellDerivationStrategy } from "../contracts/FieldMoistureCellDerivationStrategy";
import type { FieldMoistureCellObservationSource } from "../contracts/FieldMoistureCellObservationSource";

type CreateSourceBackedFieldMoistureCellDerivationStrategyOptions = {
  source: FieldMoistureCellObservationSource;
  fallbackStrategy: FieldMoistureCellDerivationStrategy;
};

export function createSourceBackedFieldMoistureCellDerivationStrategy({
  source,
  fallbackStrategy,
}: CreateSourceBackedFieldMoistureCellDerivationStrategyOptions): FieldMoistureCellDerivationStrategy {
  return {
    async deriveCells(input) {
      const observed = await source.observeCells(input);

      if (observed && observed.cells.length > 0) {
        return {
          strategyKey: `source-backed:${observed.sourceKey}`,
          cells: observed.cells,
        };
      }

      return fallbackStrategy.deriveCells(input);
    },
  };
}
