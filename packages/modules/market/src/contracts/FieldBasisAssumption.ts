export type FieldBasisAssumption = {
  id: string;
  workspaceId: string;
  fieldId: string;
  seasonYear: number | null;
  cropSymbol: string | null;
  basisCadPerTonne: number;
  sourceKey: string;
  noteText: string | null;
  assumedAt: string;
  createdAt: string;
};
