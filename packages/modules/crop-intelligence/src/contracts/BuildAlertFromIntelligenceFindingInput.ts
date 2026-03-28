import type { FieldIntelligenceFinding } from "./FieldIntelligenceFinding";

export type BuildAlertFromIntelligenceFindingInput = {
  finding: FieldIntelligenceFinding;
  sourceKeyPrefix?: string;
};
