import type { FieldBasisAssumption } from "../contracts/FieldBasisAssumption";
import type { UpsertFieldBasisAssumptionInput } from "../contracts/UpsertFieldBasisAssumptionInput";

export type FieldBasisAssumptionRepository = {
  latest(
    workspaceId: string,
    fieldId: string,
    seasonYear?: number | null,
    cropSymbol?: string | null,
  ): Promise<FieldBasisAssumption | null>;
  upsert(input: UpsertFieldBasisAssumptionInput): Promise<FieldBasisAssumption>;
};
