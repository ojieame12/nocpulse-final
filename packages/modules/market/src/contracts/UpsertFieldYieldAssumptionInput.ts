export type UpsertFieldYieldAssumptionInput = {
  workspaceId: string;
  fieldId: string;
  seasonYear?: number | null;
  cropSymbol?: string | null;
  yieldTonnesPerHa: number;
  sourceKey: string;
  noteText?: string | null;
  assumedAt?: string;
};
