export type UpsertGrainPriceSnapshotInput = {
  cropSymbol: string;
  closePriceCadPerTonne: number;
  basisCadPerTonne?: number;
  sourceCurrency?: string;
  sourceUnit?: string;
  sourceClosePrice?: number;
  fxRateToCad?: number;
  sourceKey: string;
  capturedAt?: string;
};
