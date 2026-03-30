import type { FieldAlert } from "@fieldpulse/module-alerts";
import type {
  FieldIntelligenceFinding,
  FieldZoneActivityReport,
} from "@fieldpulse/module-crop-intelligence";
import type { FieldCropContext } from "@fieldpulse/module-field-crop-context";
import type { FieldDetail } from "@fieldpulse/module-fields";
import type { FieldImportCandidate } from "@fieldpulse/module-field-intake";
import type { FieldRasterObservation } from "@fieldpulse/module-imagery";
import type {
  FieldMoistureCellSnapshot,
  FieldMoistureSnapshot,
} from "@fieldpulse/module-moisture";
import type {
  FieldWeatherDerivedSignalSet,
  FieldWeatherProfile,
} from "@fieldpulse/module-weather";
import type { TimestampIso } from "@fieldpulse/platform-db";

export type FieldReportMoistureSummary = {
  latestSnapshot: FieldMoistureSnapshot | null;
  latestCells: readonly FieldMoistureCellSnapshot[];
  latestCellCount: number;
  lowConfidenceCellCount: number;
  rootZoneMinPct: number | null;
  rootZoneMaxPct: number | null;
  rootZoneAvgPct: number | null;
  surfaceMinPct: number | null;
  surfaceMaxPct: number | null;
  surfaceAvgPct: number | null;
};

export type FieldReportSummary = {
  cropType: string | null;
  growthStage: string | null;
  activeAlertCount: number | null;
  activeFindingCount: number;
  trackedZoneCount: number;
  activeTrackedZoneCount: number;
  moistureObservedAt: TimestampIso | null;
  weatherObservedAt: TimestampIso | null;
};

export type FieldReportDataAvailability = {
  activeAlerts: boolean;
  resolvedAlerts: boolean;
};

export type FieldReportImagerySummary = {
  latestRasterObservation: FieldRasterObservation | null;
  latestCellCount: number;
  latestObservedAt: TimestampIso | null;
  latestSourceKey: string | null;
  latestProviderKey: string | null;
};

export type FieldReportReadModel = {
  generatedAt: TimestampIso;
  reportDate: TimestampIso;
  field: FieldDetail;
  cropContext: FieldCropContext | null;
  intake: {
    latestCommittedCandidate: Pick<
      FieldImportCandidate,
      "id" | "legalLandDescriptions" | "cropType" | "committedAt"
    > | null;
    legalLandDescription: string | null;
  };
  imagery: FieldReportImagerySummary;
  moisture: FieldReportMoistureSummary;
  weather: {
    profile: FieldWeatherProfile;
    signals: FieldWeatherDerivedSignalSet | null;
  };
  dataAvailability: FieldReportDataAvailability;
  alerts: readonly FieldAlert[];
  resolvedAlerts: readonly FieldAlert[];
  findings: readonly FieldIntelligenceFinding[];
  zones: FieldZoneActivityReport;
  summary: FieldReportSummary;
};
