import type { FieldBasisAssumption } from "./FieldBasisAssumption";
import type { UpsertFieldBasisAssumptionInput } from "./UpsertFieldBasisAssumptionInput";

export type FieldBasisAssumptionRepository = {
  latest(
    workspaceId: string,
    fieldId: string,
    seasonYear?: number | null,
    cropSymbol?: string | null,
  ): Promise<FieldBasisAssumption | null>;
  upsert(input: UpsertFieldBasisAssumptionInput): Promise<FieldBasisAssumption>;
};
