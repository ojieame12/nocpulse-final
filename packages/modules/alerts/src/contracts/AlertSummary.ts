import type { EntityId } from "@fieldpulse/platform-db";
import type {
  AlertFamily,
  AlertSeverity,
  AlertStatus,
} from "./FieldAlert";

export type AlertSummary = {
  id: EntityId;
  fieldId: EntityId;
  family: AlertFamily;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  sourceKey: string;
  dedupeKey: string;
  startedAt: string;
  resolvedAt: string | null;
};
