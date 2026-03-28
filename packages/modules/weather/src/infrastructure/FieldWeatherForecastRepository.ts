import type { EntityId, TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import type { ReplaceFieldWeatherForecastSetInput } from "../contracts/ReplaceFieldWeatherForecastSetInput";

export type FieldWeatherForecastRepository = {
  listByField(input: {
    workspaceId: WorkspaceId;
    fieldId: EntityId;
    validAfter?: TimestampIso;
    limit?: number;
  }): Promise<readonly FieldWeatherForecast[]>;
  replaceForecastSet(
    input: ReplaceFieldWeatherForecastSetInput,
  ): Promise<readonly FieldWeatherForecast[]>;
};
