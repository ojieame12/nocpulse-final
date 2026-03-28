import type { FieldMoistureCellObservationSource } from "../contracts/FieldMoistureCellObservationSource";

type CreateFallbackFieldMoistureCellObservationSourceOptions = {
  primary: FieldMoistureCellObservationSource;
  fallback: FieldMoistureCellObservationSource;
};

export function createFallbackFieldMoistureCellObservationSource({
  primary,
  fallback,
}: CreateFallbackFieldMoistureCellObservationSourceOptions): FieldMoistureCellObservationSource {
  return {
    async observeCells(input) {
      const primaryResult = await primary.observeCells(input);

      if (primaryResult && primaryResult.cells.length > 0) {
        return primaryResult;
      }

      return fallback.observeCells(input);
    },
  };
}
