import { listWorkspaceFieldOverview } from "@fieldpulse/module-fields";
import {
  resolveWorkspaceSelection,
  type ResolvedWorkspaceSelection,
} from "@fieldpulse/module-workspaces";
import { buildFieldReportReadModel } from "@fieldpulse/module-reports";
import type { ServerRepositories } from "../contracts/ServerRuntime";
import type {
  LoadWorkspaceFieldDetailInput,
  LoadWorkspaceFieldOverviewInput,
  WorkspaceFieldDetailSelection,
  WorkspaceFieldOverviewSelection,
} from "../contracts/ServerServices";

export async function resolvePreferredWorkspaceSelection(
  repositories: Pick<
    ServerRepositories,
    "workspaces" | "workspaceMemberships"
  >,
  input: LoadWorkspaceFieldOverviewInput,
): Promise<ResolvedWorkspaceSelection> {
  if (!(input.actorUserId && input.preferredWorkspaceId)) {
    return resolveWorkspaceSelection({
      repository: repositories.workspaces,
      actorUserId: input.actorUserId,
      preferredWorkspaceId: input.preferredWorkspaceId,
    });
  }

  const [membership, selectedWorkspace] = await Promise.all([
    repositories.workspaceMemberships.getByWorkspaceAndUser(
      input.preferredWorkspaceId,
      input.actorUserId,
    ),
    repositories.workspaces.getById(input.preferredWorkspaceId),
  ]);

  return {
    selectionMode: "workspace",
    workspaces: membership && selectedWorkspace ? [selectedWorkspace] : [],
    selectedWorkspace: membership ? selectedWorkspace : null,
  };
}

export async function loadWorkspaceFieldOverview(
  repositories: ServerRepositories,
  input: LoadWorkspaceFieldOverviewInput,
): Promise<WorkspaceFieldOverviewSelection> {
  const selection = await resolvePreferredWorkspaceSelection(repositories, input);

  const fields = selection.selectedWorkspace
    ? await listWorkspaceFieldOverview({
        repository: repositories.fields,
        workspaceId: selection.selectedWorkspace.id,
      })
    : [];

  return {
    ...selection,
    fields,
    primaryField: fields[0] ?? null,
  };
}

export async function loadWorkspaceFieldDetail(
  repositories: ServerRepositories,
  input: LoadWorkspaceFieldDetailInput,
): Promise<WorkspaceFieldDetailSelection> {
  const selection = await resolvePreferredWorkspaceSelection(repositories, input);

  if (!selection.selectedWorkspace) {
    return {
      ...selection,
      fields: [],
      field: null,
    };
  }

  const workspaceId = selection.selectedWorkspace.id;
  const reportDate = new Date().toISOString();
  const fieldsPromise = listWorkspaceFieldOverview({
    repository: repositories.fields,
    workspaceId,
  });
  const detailPromise = repositories.fields.getById(workspaceId, input.fieldId);
  const readModelPromise = detailPromise.then((detail) => {
    if (!detail) {
      return null;
    }

    return buildFieldReportReadModel({
      repositories: {
        fields: repositories.fields,
        fieldImportBatches: repositories.fieldImportBatches,
        cropContexts: repositories.fieldCropContexts,
        imageryRasterObservations: repositories.imageryRasterObservations,
        moistureSnapshots: repositories.moistureSnapshots,
        moistureCells: repositories.moistureCellSnapshots,
        weatherObservations: repositories.weatherObservations,
        weatherForecasts: repositories.weatherForecasts,
        weatherSignals: repositories.weatherSignalSets,
        alerts: repositories.alerts,
        findings: repositories.cropIntelligenceFindings,
        zones: repositories.cropIntelligenceZones,
      },
      workspaceId,
      fieldId: detail.id,
      field: detail,
      reportDate,
    });
  });
  const [fields, detail, readModel] = await Promise.all([
    fieldsPromise,
    detailPromise,
    readModelPromise,
  ]);

  if (!detail) {
    return {
      ...selection,
      fields,
      field: null,
    };
  }

  return {
    ...selection,
    fields,
    field: {
      detail,
      overview: fields.find((field) => field.id === detail.id) ?? null,
      readModel:
        readModel ??
        (await buildFieldReportReadModel({
          repositories: {
            fields: repositories.fields,
            fieldImportBatches: repositories.fieldImportBatches,
            cropContexts: repositories.fieldCropContexts,
            imageryRasterObservations: repositories.imageryRasterObservations,
            moistureSnapshots: repositories.moistureSnapshots,
            moistureCells: repositories.moistureCellSnapshots,
            weatherObservations: repositories.weatherObservations,
            weatherForecasts: repositories.weatherForecasts,
            weatherSignals: repositories.weatherSignalSets,
            alerts: repositories.alerts,
            findings: repositories.cropIntelligenceFindings,
            zones: repositories.cropIntelligenceZones,
          },
          workspaceId,
          fieldId: detail.id,
          field: detail,
          reportDate,
        })),
    },
  };
}
