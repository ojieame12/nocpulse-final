import assert from "node:assert/strict";
import test from "node:test";
import type { FieldAlert } from "../../../alerts/src/contracts/FieldAlert";
import type { FieldDetail } from "../../../fields/src/contracts/FieldDetail";
import type { FieldMoistureSnapshot } from "../../../moisture/src/contracts/FieldMoistureSnapshot";
import { buildFieldReportReadModel } from "./buildFieldReportReadModel";

function createFieldAlert(input: {
  id: string;
  status: FieldAlert["status"];
  startedAt: string;
}): FieldAlert {
  return {
    id: input.id,
    workspaceId: "workspace-1",
    fieldId: "field-1",
    family: "weather_risk",
    severity: "medium",
    status: input.status,
    sourceKey: `source:${input.id}`,
    dedupeKey: `dedupe:${input.id}`,
    title: `Alert ${input.id}`,
    summary: null,
    explanation: null,
    recommendedAction: null,
    facts: {},
    evidence: {},
    startedAt: input.startedAt,
    endedAt: null,
    acknowledgedAt: null,
    acknowledgedByUserId: null,
    resolvedAt: input.status === "resolved" ? input.startedAt : null,
    resolutionNote: null,
    createdAt: input.startedAt,
    updatedAt: input.startedAt,
  };
}

const field = {
  id: "field-1",
  workspaceId: "workspace-1",
  name: "North Quarter",
  areaHa: 64.2,
  legalLandDescription: null,
  boundary: {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [-101.0, 49.0],
          [-100.9, 49.0],
          [-100.9, 49.1],
          [-101.0, 49.1],
          [-101.0, 49.0],
        ],
      ],
    ],
  },
  labelPoint: [-100.95, 49.05],
  createdBy: "user-1",
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
} satisfies FieldDetail;

test("buildFieldReportReadModel fetches active and resolved alerts once and splits them per status", async () => {
  const alertCalls: Array<{
    workspaceId: string;
    fieldId: string;
    limit: number | undefined;
    status: FieldAlert["status"] | readonly FieldAlert["status"][] | undefined;
  }> = [];

  const readModel = await buildFieldReportReadModel({
    repositories: {
      fields: {
        async getById() {
          throw new Error("expected provided field to be reused");
        },
      },
      fieldImportBatches: {
        async getLatestCommittedCandidateByField() {
          return null;
        },
      },
      cropContexts: {
        async getLatestByField() {
          return null;
        },
      },
      imageryRasterObservations: {
        async getLatestByField() {
          return null;
        },
      },
      moistureSnapshots: {
        async getLatestByField() {
          return null;
        },
        async listRecentByField() {
          return [];
        },
      },
      moistureCells: {
        async getLatestByField() {
          return [];
        },
      },
      weatherObservations: {
        async getLatestByField() {
          return null;
        },
        async listRecentByField() {
          return [];
        },
      },
      weatherForecasts: {
        async listByField() {
          return [];
        },
      },
      weatherSignals: {
        async getLatestByField() {
          return null;
        },
      },
      alerts: {
        async listByField(workspaceId, fieldId, limit, status) {
          alertCalls.push({ workspaceId, fieldId, limit, status });

          return [
            createFieldAlert({
              id: "alert-resolved-1",
              status: "resolved",
              startedAt: "2026-03-29T08:00:00.000Z",
            }),
            createFieldAlert({
              id: "alert-active-1",
              status: "active",
              startedAt: "2026-03-29T07:00:00.000Z",
            }),
            createFieldAlert({
              id: "alert-active-2",
              status: "active",
              startedAt: "2026-03-29T06:00:00.000Z",
            }),
            createFieldAlert({
              id: "alert-resolved-2",
              status: "resolved",
              startedAt: "2026-03-29T05:00:00.000Z",
            }),
            createFieldAlert({
              id: "alert-active-3",
              status: "active",
              startedAt: "2026-03-29T04:00:00.000Z",
            }),
            createFieldAlert({
              id: "alert-resolved-3",
              status: "resolved",
              startedAt: "2026-03-29T03:00:00.000Z",
            }),
          ];
        },
      },
      findings: {
        async listByField() {
          return [];
        },
      },
      zones: {
        async listByField() {
          return [];
        },
      },
    },
    workspaceId: "workspace-1",
    fieldId: "field-1",
    field,
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
    alertLimit: 2,
  });

  assert.equal(alertCalls.length, 1);
  assert.deepEqual(alertCalls[0], {
    workspaceId: "workspace-1",
    fieldId: "field-1",
    limit: 40,
    status: ["active", "resolved"],
  });
  assert.deepEqual(
    readModel.alerts.map((alert) => alert.id),
    ["alert-active-1", "alert-active-2"],
  );
  assert.deepEqual(
    readModel.resolvedAlerts.map((alert) => alert.id),
    ["alert-resolved-1", "alert-resolved-2"],
  );
  assert.equal(readModel.summary.activeAlertCount, 2);
  assert.deepEqual(readModel.dataAvailability, {
    activeAlerts: true,
    resolvedAlerts: true,
  });
});

test("buildFieldReportReadModel overlaps field lookup with other repository reads when field is not provided", async () => {
  let fieldResolved = false;
  let latestCandidateStartedWhileFieldPending = false;

  const readModel = await buildFieldReportReadModel({
    repositories: {
      fields: {
        async getById() {
          await new Promise((resolve) => {
            setTimeout(resolve, 20);
          });
          fieldResolved = true;
          return field;
        },
      },
      fieldImportBatches: {
        async getLatestCommittedCandidateByField() {
          latestCandidateStartedWhileFieldPending = !fieldResolved;
          return null;
        },
      },
      cropContexts: {
        async getLatestByField() {
          return null;
        },
      },
      imageryRasterObservations: {
        async getLatestByField() {
          return null;
        },
      },
      moistureSnapshots: {
        async getLatestByField() {
          return null;
        },
        async listRecentByField() {
          return [];
        },
      },
      moistureCells: {
        async getLatestByField() {
          return [];
        },
      },
      weatherObservations: {
        async getLatestByField() {
          return null;
        },
        async listRecentByField() {
          return [];
        },
      },
      weatherForecasts: {
        async listByField() {
          return [];
        },
      },
      weatherSignals: {
        async getLatestByField() {
          return null;
        },
      },
      alerts: {
        async listByField() {
          return [];
        },
      },
      findings: {
        async listByField() {
          return [];
        },
      },
      zones: {
        async listByField() {
          return [];
        },
      },
    },
    workspaceId: "workspace-1",
    fieldId: "field-1",
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
  });

  assert.equal(latestCandidateStartedWhileFieldPending, true);
  assert.equal(readModel.field.id, "field-1");
});

// ---------------------------------------------------------------------------
// Helpers for depletion / historical-anomaly tests
// ---------------------------------------------------------------------------

function createMoistureSnapshot(
  inputs: FieldMoistureSnapshot["inputs"],
): FieldMoistureSnapshot {
  return {
    id: "snap-1",
    workspaceId: "workspace-1",
    fieldId: "field-1",
    observedAt: "2026-03-28T12:00:00.000Z" as FieldMoistureSnapshot["observedAt"],
    sourceKey: "test",
    rootZonePct: 30,
    surfacePct: 25,
    confidence: "high",
    inputs,
    createdAt: "2026-03-28T12:00:00.000Z" as FieldMoistureSnapshot["createdAt"],
  };
}

function createEmptyRepositories(overrides?: {
  moistureSnapshots?: {
    getLatestByField: () => Promise<FieldMoistureSnapshot | null>;
    listRecentByField: () => Promise<readonly FieldMoistureSnapshot[]>;
  };
}) {
  return {
    fields: {
      async getById() {
        throw new Error("should not be called when field is provided");
      },
    },
    fieldImportBatches: {
      async getLatestCommittedCandidateByField() {
        return null;
      },
    },
    cropContexts: {
      async getLatestByField() {
        return null;
      },
    },
    imageryRasterObservations: {
      async getLatestByField() {
        return null;
      },
    },
    moistureSnapshots: overrides?.moistureSnapshots ?? {
      async getLatestByField() {
        return null;
      },
      async listRecentByField() {
        return [];
      },
    },
    moistureCells: {
      async getLatestByField() {
        return [];
      },
    },
    weatherObservations: {
      async getLatestByField() {
        return null;
      },
      async listRecentByField() {
        return [];
      },
    },
    weatherForecasts: {
      async listByField() {
        return [];
      },
    },
    weatherSignals: {
      async getLatestByField() {
        return null;
      },
    },
    alerts: {
      async listByField() {
        return [];
      },
    },
    findings: {
      async listByField() {
        return [];
      },
    },
    zones: {
      async listByField() {
        return [];
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Depletion fields
// ---------------------------------------------------------------------------

test("read model includes depletionPct and availableWaterMm when snapshot has them", async () => {
  const readModel = await buildFieldReportReadModel({
    repositories: createEmptyRepositories({
      moistureSnapshots: {
        async getLatestByField() {
          return createMoistureSnapshot({ depletionPct: 42, availableWaterMm: 18.5 });
        },
        async listRecentByField() {
          return [];
        },
      },
    }),
    workspaceId: "workspace-1",
    fieldId: "field-1",
    field,
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
  });

  assert.equal(readModel.depletionPct, 42);
  assert.equal(readModel.availableWaterMm, 18.5);
});

test("read model statusLabel is 'Adequate' for depletionPct <= 30", async () => {
  const readModel = await buildFieldReportReadModel({
    repositories: createEmptyRepositories({
      moistureSnapshots: {
        async getLatestByField() {
          return createMoistureSnapshot({ depletionPct: 20, availableWaterMm: 50 });
        },
        async listRecentByField() {
          return [];
        },
      },
    }),
    workspaceId: "workspace-1",
    fieldId: "field-1",
    field,
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
  });

  assert.equal(readModel.statusLabel, "Adequate");
});

test("read model statusLabel is 'Watch' for depletionPct 30-50", async () => {
  const readModel = await buildFieldReportReadModel({
    repositories: createEmptyRepositories({
      moistureSnapshots: {
        async getLatestByField() {
          return createMoistureSnapshot({ depletionPct: 42, availableWaterMm: 30 });
        },
        async listRecentByField() {
          return [];
        },
      },
    }),
    workspaceId: "workspace-1",
    fieldId: "field-1",
    field,
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
  });

  assert.equal(readModel.statusLabel, "Watch");
});

test("read model statusLabel is 'Stress' for depletionPct 50-75", async () => {
  const readModel = await buildFieldReportReadModel({
    repositories: createEmptyRepositories({
      moistureSnapshots: {
        async getLatestByField() {
          return createMoistureSnapshot({ depletionPct: 65, availableWaterMm: 15 });
        },
        async listRecentByField() {
          return [];
        },
      },
    }),
    workspaceId: "workspace-1",
    fieldId: "field-1",
    field,
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
  });

  assert.equal(readModel.statusLabel, "Stress");
});

test("read model statusLabel is 'Critical' for depletionPct > 75", async () => {
  const readModel = await buildFieldReportReadModel({
    repositories: createEmptyRepositories({
      moistureSnapshots: {
        async getLatestByField() {
          return createMoistureSnapshot({ depletionPct: 85, availableWaterMm: 5 });
        },
        async listRecentByField() {
          return [];
        },
      },
    }),
    workspaceId: "workspace-1",
    fieldId: "field-1",
    field,
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
  });

  assert.equal(readModel.statusLabel, "Critical");
});

test("read model depletion fields are null when snapshot lacks soil properties", async () => {
  const readModel = await buildFieldReportReadModel({
    repositories: createEmptyRepositories({
      moistureSnapshots: {
        async getLatestByField() {
          return createMoistureSnapshot({});
        },
        async listRecentByField() {
          return [];
        },
      },
    }),
    workspaceId: "workspace-1",
    fieldId: "field-1",
    field,
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
  });

  assert.equal(readModel.depletionPct, null);
  assert.equal(readModel.availableWaterMm, null);
  assert.equal(readModel.statusLabel, undefined);
});

test("read model depletion fields are null when no moisture snapshot exists", async () => {
  const readModel = await buildFieldReportReadModel({
    repositories: createEmptyRepositories(),
    workspaceId: "workspace-1",
    fieldId: "field-1",
    field,
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
  });

  assert.equal(readModel.depletionPct, null);
  assert.equal(readModel.availableWaterMm, null);
  assert.equal(readModel.statusLabel, undefined);
});

test("historical anomaly fields are undefined when not provided", async () => {
  const readModel = await buildFieldReportReadModel({
    repositories: createEmptyRepositories(),
    workspaceId: "workspace-1",
    fieldId: "field-1",
    field,
    reportDate: "2026-03-29T00:00:00.000Z",
    generatedAt: "2026-03-29T10:00:00.000Z",
  });

  assert.equal(readModel.historicalAnomalyPercentile, undefined);
  assert.equal(readModel.historicalAnomalyDescription, undefined);
  assert.equal(readModel.historicalAnomalyClass, undefined);
});
