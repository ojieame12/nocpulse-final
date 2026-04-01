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
  FieldWeatherObservation,
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
  /** Recent moisture snapshots for trend display (newest first, up to 14). */
  recentSnapshots: readonly FieldMoistureSnapshot[];
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
    /** Recent weather observations for past-temperature display (newest first, up to 7). */
    recentObservations: readonly FieldWeatherObservation[];
  };
  dataAvailability: FieldReportDataAvailability;
  alerts: readonly FieldAlert[];
  resolvedAlerts: readonly FieldAlert[];
  findings: readonly FieldIntelligenceFinding[];
  zones: FieldZoneActivityReport;
  summary: FieldReportSummary;

  /**
   * Depletion fields extracted from the latest moisture snapshot's inputs.
   * Populated during the overview_rebuild phase when the snapshot includes
   * soil-property-backed depletion data.
   */
  depletionPct?: number | null;
  availableWaterMm?: number | null;
  statusLabel?: string;

  /**
   * Pre-computed historical anomaly fields, populated by the worker during
   * the overview_rebuild phase. Optional — absent until the worker has run
   * the historical comparison for this field.
   */
  historicalAnomalyPercentile?: number | null;
  historicalAnomalyDescription?: string | null;
  historicalAnomalyClass?: 'unusually-dry' | 'normal' | 'unusually-wet' | null;
};
