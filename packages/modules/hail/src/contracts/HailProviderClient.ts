import type { JsonValue, TimestampIso } from "@fieldpulse/platform-db";
import type {
  HailEventType,
  HailProvider,
  HailSeverity,
} from "./HailProvider";

export type HailGeoPoint = readonly [longitude: number, latitude: number];

export type HailMultiPolygonGeoJson = {
  type: "MultiPolygon";
  coordinates: readonly (readonly (readonly HailGeoPoint[])[])[];
};

export type FetchFieldHailEventsInput = {
  boundary: HailMultiPolygonGeoJson;
  requestedAt?: TimestampIso;
  limit?: number;
};

export type FetchedFieldHailEvent = {
  sourceEventKey: string;
  dedupeKey: string;
  eventType: HailEventType;
  severity: HailSeverity;
  reportedAt: TimestampIso;
  windowStart?: TimestampIso | null;
  windowEnd?: TimestampIso | null;
  headline: string;
  summary?: string | null;
  hailSizeMm?: number | null;
  coverageGeoJson?: JsonValue | null;
  provenance?: JsonValue;
};

export type FetchFieldHailEventsResult = {
  providerKey: HailProvider;
  sourceKey: string;
  requestedAt: TimestampIso;
  events: readonly FetchedFieldHailEvent[];
};

export type HailProviderClient = {
  providerKey: HailProvider;
  fetchFieldHailEvents(
    input: FetchFieldHailEventsInput,
  ): Promise<FetchFieldHailEventsResult>;
};
