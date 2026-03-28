import type { Audited, EntityId, UserId, WorkspaceScoped } from "@fieldpulse/platform-db";
import type { FieldBoundary, GeoPoint } from "./FieldBoundary";

export type FieldDetail = WorkspaceScoped &
  Audited & {
    id: EntityId;
    name: string;
    areaHa: number;
    legalLandDescription: string | null;
    boundary: FieldBoundary;
    labelPoint: GeoPoint;
    createdBy: UserId;
  };
