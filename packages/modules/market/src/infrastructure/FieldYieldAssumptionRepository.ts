import type { FieldYieldAssumption } from "../contracts/FieldYieldAssumption";
import type { UpsertFieldYieldAssumptionInput } from "../contracts/UpsertFieldYieldAssumptionInput";

export type FieldYieldAssumptionRepository = {
  latest(
    workspaceId: string,
    fieldId: string,
    seasonYear?: number | null,
    cropSymbol?: string | null,
  ): Promise<FieldYieldAssumption | null>;
  upsert(input: UpsertFieldYieldAssumptionInput): Promise<FieldYieldAssumption>;
};
