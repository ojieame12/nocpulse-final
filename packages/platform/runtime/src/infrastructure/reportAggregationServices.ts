import { listWorkspaceFieldOverview } from "@fieldpulse/module-fields";
import {
  buildHailRefreshReport,
} from "@fieldpulse/module-hail";
import {
  buildImagerySyncReport,
  buildImageryProviderProbeFallbackReport,
  listRecentImageryProviderProbeHistory,
} from "@fieldpulse/module-imagery";
import { buildDiseaseRiskReport } from "@fieldpulse/module-crop-intelligence";
import { buildWeatherRefreshReport } from "@fieldpulse/module-weather";
import type { ServerRepositories } from "../contracts/ServerRuntime";

const DISEASE_RISK_SOURCE_KEY = "disease-risk-generator";
const REPORT_WORKSPACE_CONCURRENCY = 6;
const REPORT_FIELD_CONCURRENCY = 12;

type WorkspaceFieldLabel = {
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  fieldName?: string | null;
};

type WorkspaceFieldCatalog = {
  fields: Array<{ workspaceId: string; fieldId: string }>;
  fieldLabelsById: Record<string, WorkspaceFieldLabel>;
};

async function mapWithConcurrency<T, TResult>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function flattenReadonlyArrays<T>(batches: readonly (readonly T[])[]) {
  return batches.flatMap((batch) => [...batch]);
}

async function resolveScopedWorkspaces(
  repositories: Pick<ServerRepositories, "workspaces">,
  workspaceId: string | undefined,
  missingContext: string | null,
) {
  if (!workspaceId) {
    return repositories.workspaces.listAll();
  }

  const selectedWorkspace = await repositories.workspaces.getById(workspaceId);

  if (!selectedWorkspace) {
    if (missingContext) {
      throw new Error(
        `[runtime] workspace ${workspaceId} was not found for ${missingContext}`,
      );
    }

    return [];
  }

  return [selectedWorkspace];
}

async function loadExistingWorkspacesById(
  repositories: Pick<ServerRepositories, "workspaces">,
  workspaceIds: readonly string[],
) {
  const uniqueWorkspaceIds = Array.from(new Set(workspaceIds));

  if (uniqueWorkspaceIds.length === 0) {
    return [];
  }

  const workspaces = await mapWithConcurrency(
    uniqueWorkspaceIds,
    REPORT_WORKSPACE_CONCURRENCY,
    (workspaceId) => repositories.workspaces.getById(workspaceId),
  );

  return workspaces.filter((workspace): workspace is NonNullable<typeof workspace> => workspace != null);
}

async function loadWorkspaceFieldCatalog(
  repositories: Pick<ServerRepositories, "fields">,
  workspaces: ReadonlyArray<{ id: string; name: string; slug: string }>,
): Promise<WorkspaceFieldCatalog> {
  const workspaceOverviews = await mapWithConcurrency(
    workspaces,
    REPORT_WORKSPACE_CONCURRENCY,
    async (workspace) => ({
      workspace,
      overview: await listWorkspaceFieldOverview({
        repository: repositories.fields,
        workspaceId: workspace.id,
      }),
    }),
  );
  const fields: Array<{ workspaceId: string; fieldId: string }> = [];
  const fieldLabelsById: Record<string, WorkspaceFieldLabel> = {};

  for (const { workspace, overview } of workspaceOverviews) {
    for (const field of overview) {
      fields.push({
        workspaceId: workspace.id,
        fieldId: field.id,
      });
      fieldLabelsById[field.id] = {
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        fieldName: field.name,
      };
    }
  }

  return {
    fields,
    fieldLabelsById,
  };
}

export async function buildRecentImageryProviderProbeFallbackReport(
  repositories: ServerRepositories,
  input: {
    createdAfter?: string;
    limit?: number;
  } = {},
) {
  const records = await listRecentImageryProviderProbeHistory(
    repositories.imageryProviderProbes,
    input,
  );

  const relevantWorkspaces = await loadExistingWorkspacesById(
    repositories,
    records.map((record) => record.workspaceId),
  );
  const { fieldLabelsById } = await loadWorkspaceFieldCatalog(
    repositories,
    relevantWorkspaces,
  );

  return buildImageryProviderProbeFallbackReport({
    createdAfter: input.createdAfter ?? null,
    records,
    fieldLabelsById,
  });
}

export async function buildRecentImagerySyncReport(
  repositories: ServerRepositories,
  input: {
    workspaceId?: string;
    createdAfter?: string;
    staleAfterHours?: number;
    limit?: number;
  } = {},
) {
  const staleAfterHours = input.staleAfterHours ?? 24;
  const staleBefore = new Date(
    Date.now() - staleAfterHours * 60 * 60 * 1000,
  ).toISOString();
  const recentCapturesPromise = repositories.imageryCaptures.listRecent({
    workspaceId: input.workspaceId,
    createdAfter: input.createdAfter,
    limit: input.limit,
  });
  const scopedWorkspaces = await resolveScopedWorkspaces(
    repositories,
    input.workspaceId,
    null,
  );
  const catalogPromise = loadWorkspaceFieldCatalog(repositories, scopedWorkspaces);
  const latestCapturesPromise = catalogPromise.then(async ({ fields }) =>
    (
      await mapWithConcurrency(
        fields,
        REPORT_FIELD_CONCURRENCY,
        (field) =>
          repositories.imageryCaptures.getLatestByField(
            field.workspaceId,
            field.fieldId,
          ),
      )
    ).filter((capture): capture is NonNullable<typeof capture> => capture != null),
  );
  const [
    recentCaptures,
    { fields, fieldLabelsById },
    latestCaptures,
  ] = await Promise.all([
    recentCapturesPromise,
    catalogPromise,
    latestCapturesPromise,
  ]);

  return buildImagerySyncReport({
    createdAfter: input.createdAfter ?? null,
    staleBefore,
    recentCaptures,
    latestCaptures,
    fields,
    fieldLabelsById,
  });
}

export async function buildRecentWeatherRefreshReport(
  repositories: ServerRepositories,
  input: {
    workspaceId?: string;
    updatedAfter?: string;
    staleAfterHours?: number;
    limit?: number;
  } = {},
) {
  const staleAfterHours = input.staleAfterHours ?? 12;

  if (staleAfterHours < 0) {
    throw new Error("[runtime] staleAfterHours must be non-negative");
  }

  const staleBefore = new Date(
    Date.now() - staleAfterHours * 60 * 60 * 1000,
  ).toISOString();
  const recentObservationsPromise =
    repositories.weatherObservations.listRecentObservations({
      workspaceId: input.workspaceId,
      updatedAfter: input.updatedAfter,
      limit: input.limit,
    });
  const workspaces = await resolveScopedWorkspaces(
    repositories,
    input.workspaceId,
    "weather reporting",
  );
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const [
    { fields, fieldLabelsById },
    latestObservationBatches,
    recentObservations,
  ] = await Promise.all([
    loadWorkspaceFieldCatalog(repositories, workspaces),
    mapWithConcurrency(
      workspaces,
      REPORT_WORKSPACE_CONCURRENCY,
      (workspace) =>
        repositories.weatherObservations.listLatestByWorkspace(workspace.id),
    ),
    recentObservationsPromise,
  ]);
  const latestObservations = flattenReadonlyArrays(latestObservationBatches);
  const filteredRecentObservations = recentObservations.filter((observation) =>
    workspaceIds.has(observation.workspaceId),
  );

  return buildWeatherRefreshReport({
    updatedAfter: input.updatedAfter ?? null,
    staleBefore,
    recentObservations: filteredRecentObservations,
    latestObservations,
    fields,
    fieldLabelsById,
  });
}

export async function buildRecentHailRefreshReport(
  repositories: ServerRepositories,
  input: {
    workspaceId?: string;
    requestedAfter?: string;
    staleAfterHours?: number;
    limit?: number;
  } = {},
) {
  const staleAfterHours = input.staleAfterHours ?? 24;

  if (staleAfterHours < 0) {
    throw new Error("[runtime] staleAfterHours must be non-negative");
  }

  const staleBefore = new Date(
    Date.now() - staleAfterHours * 60 * 60 * 1000,
  ).toISOString();
  const recentRunsPromise = repositories.hailRefreshRuns.listRecentRuns({
    workspaceId: input.workspaceId,
    requestedAfter: input.requestedAfter,
    limit: input.limit,
  });
  const workspaces = await resolveScopedWorkspaces(
    repositories,
    input.workspaceId,
    "hail reporting",
  );
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const [{ fields, fieldLabelsById }, latestRunBatches, recentRuns] =
    await Promise.all([
      loadWorkspaceFieldCatalog(repositories, workspaces),
      mapWithConcurrency(
        workspaces,
        REPORT_WORKSPACE_CONCURRENCY,
        (workspace) =>
          repositories.hailRefreshRuns.listLatestByWorkspace(workspace.id),
      ),
      recentRunsPromise,
    ]);
  const latestRuns = flattenReadonlyArrays(latestRunBatches);
  const filteredRecentRuns = recentRuns.filter((run) =>
    workspaceIds.has(run.workspaceId),
  );

  return buildHailRefreshReport({
    requestedAfter: input.requestedAfter ?? null,
    staleBefore,
    recentRuns: filteredRecentRuns,
    latestRuns,
    fields,
    fieldLabelsById,
  });
}

export async function buildRecentDiseaseRiskReport(
  repositories: ServerRepositories,
  input: {
    workspaceId?: string;
    startedAfter?: string;
    staleAfterHours?: number;
    limit?: number;
  } = {},
) {
  const staleAfterHours = input.staleAfterHours ?? 24;

  if (staleAfterHours < 0) {
    throw new Error("[runtime] staleAfterHours must be non-negative");
  }

  const staleBefore = new Date(
    Date.now() - staleAfterHours * 60 * 60 * 1000,
  ).toISOString();
  const workspaces = await resolveScopedWorkspaces(
    repositories,
    input.workspaceId,
    "disease risk reporting",
  );
  const [
    { fields, fieldLabelsById },
    latestRunBatches,
    recentRunBatches,
    activeFindingBatches,
  ] = await Promise.all([
    loadWorkspaceFieldCatalog(repositories, workspaces),
    mapWithConcurrency(
      workspaces,
      REPORT_WORKSPACE_CONCURRENCY,
      (workspace) =>
        repositories.cropIntelligenceRuns.listLatestByWorkspace(
          workspace.id,
          DISEASE_RISK_SOURCE_KEY,
        ),
    ),
    mapWithConcurrency(
      workspaces,
      REPORT_WORKSPACE_CONCURRENCY,
      (workspace) =>
        repositories.cropIntelligenceRuns.listRecentRuns({
          workspaceId: workspace.id,
          startedAfter: input.startedAfter,
          limit: input.limit,
          sourceKey: DISEASE_RISK_SOURCE_KEY,
        }),
    ),
    mapWithConcurrency(
      workspaces,
      REPORT_WORKSPACE_CONCURRENCY,
      (workspace) =>
        repositories.cropIntelligenceFindings.listRecentByWorkspace({
          workspaceId: workspace.id,
          limit: input.limit,
          status: "active",
          family: "disease_risk",
          updatedAfter: input.startedAfter,
        }),
    ),
  ]);
  const latestRuns = flattenReadonlyArrays(latestRunBatches);
  const recentRuns = flattenReadonlyArrays(recentRunBatches);
  const activeFindings = flattenReadonlyArrays(activeFindingBatches);

  return buildDiseaseRiskReport({
    startedAfter: input.startedAfter ?? null,
    staleBefore,
    recentRuns,
    latestRuns,
    activeFindings,
    fields,
    fieldLabelsById,
  });
}
