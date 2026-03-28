import type {
  DerivedFieldMoistureCell,
  FieldMoistureCellDerivationInput,
} from "./FieldMoistureCellDerivationStrategy";

export type FieldMoistureCellObservationResult = {
  sourceKey: string;
  cells: readonly DerivedFieldMoistureCell[];
};

export type FieldMoistureCellObservationSource = {
  observeCells(
    input: FieldMoistureCellDerivationInput,
  ): Promise<FieldMoistureCellObservationResult | null> | FieldMoistureCellObservationResult | null;
};
