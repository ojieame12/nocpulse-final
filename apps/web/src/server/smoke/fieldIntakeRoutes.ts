import { loadEnvFile } from "@fieldpulse/platform-config";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { POST as parseGeofile } from "../../app/api/field-intake/geofile/parse/route";
import { POST as createGeofile } from "../../app/api/field-intake/geofile/create/route";
import { POST as createLldField } from "../../app/api/field-intake/lld/create/route";
import { POST as lookupLld } from "../../app/api/field-intake/lld/lookup/route";
import { GET as getActor } from "../../app/api/auth/actor/route";
import { POST as saveBatch } from "../../app/api/field-intake/spreadsheet/batches/route";
import { POST as commitBatch } from "../../app/api/field-intake/spreadsheet/batches/[batchId]/commit/route";
import { POST as previewSpreadsheet } from "../../app/api/field-intake/spreadsheet/preview/route";
import {
  createDevelopmentFallbackToken,
  DEVELOPMENT_FALLBACK_HEADER,
} from "../auth/developmentFallback";

const FALLBACK_ACTOR_USER_ID = "00000000-0000-4000-8000-000000000001";

function assertRouteStatus(
  label: string,
  status: number,
  expected: number | number[],
) {
  const allowedStatuses = Array.isArray(expected) ? expected : [expected];

  if (!allowedStatuses.includes(status)) {
    throw new Error(
      `${label} returned ${status}, expected ${allowedStatuses.join(" or ")}`,
    );
  }
}

function assertPresent<T>(
  label: string,
  value: T | null | undefined,
): asserts value is T {
  if (value == null) {
    throw new Error(`${label} was not returned by the route response`);
  }
}

async function main() {
  loadEnvFile({
    fileName: ".env.local",
  });
  loadEnvFile();
  const runId = Date.now().toString(36);

  const runtime = createServerRuntime(process.env);

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const actorUserId = runtime.env.devActorUserId ?? FALLBACK_ACTOR_USER_ID;
  const workspace = (await runtime.services.workspaces.listForUser(actorUserId))[0];
  const developmentFallbackToken = await createDevelopmentFallbackToken({
    serviceRoleKey: runtime.env.supabase.serviceRoleKey,
    devActorUserId: runtime.env.devActorUserId,
  });

  if (!workspace) {
    throw new Error(`No workspace is available for actor ${actorUserId}`);
  }

  if (!developmentFallbackToken) {
    throw new Error("Development fallback token could not be created.");
  }

  const actorHeaders = {
    "x-fieldpulse-user-id": actorUserId,
    "x-fieldpulse-workspace-id": workspace.id,
    [DEVELOPMENT_FALLBACK_HEADER]: developmentFallbackToken,
  } as const;

  const lldResponse = await lookupLld(
    new Request("http://localhost/api/field-intake/lld/lookup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        code: "NW-25-042-04-W4",
        suggestedFieldName: `Route LLD North ${runId}`,
      }),
    }),
  );
  const lldJson = await lldResponse.json();
  assertRouteStatus("LLD lookup", lldResponse.status, 200);
  const lldCreateResponse = await createLldField(
    new Request("http://localhost/api/field-intake/lld/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...actorHeaders,
      },
      body: JSON.stringify({
        code: "NW-25-042-04-W4",
        suggestedFieldName: `Route LLD Created ${runId}`,
        cropType: "barley",
      }),
    }),
  );
  const lldCreateJson = await lldCreateResponse.json();
  assertRouteStatus("LLD create", lldCreateResponse.status, 201);
  const actorResponse = await getActor(
    new Request("http://localhost/api/auth/actor", {
      headers: actorHeaders,
    }),
  );
  const actorJson = await actorResponse.json();

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name: "Route Geojson Field",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-104.7, 50.45],
              [-104.69, 50.45],
              [-104.69, 50.44],
              [-104.7, 50.44],
              [-104.7, 50.45],
            ],
          ],
        },
      },
    ],
  };

  const geofileForm = new FormData();
  geofileForm.set(
    "file",
    new File([JSON.stringify(geojson)], "field.geojson", {
      type: "application/geo+json",
    }),
  );
  const geofileResponse = await parseGeofile(
    new Request("http://localhost/api/field-intake/geofile/parse", {
      method: "POST",
      body: geofileForm,
    }),
  );
  const geofileJson = await geofileResponse.json();
  assertRouteStatus("Geofile parse", geofileResponse.status, 200);
  const geofileCreateForm = new FormData();
  geofileCreateForm.set(
    "file",
    new File([JSON.stringify(geojson)], "field.geojson", {
      type: "application/geo+json",
    }),
  );
  geofileCreateForm.set("suggestedFieldName", `Route Geojson Created ${runId}`);
  geofileCreateForm.set("workspaceId", workspace.id);
  geofileCreateForm.set("cropType", "canola");
  const geofileCreateResponse = await createGeofile(
    new Request("http://localhost/api/field-intake/geofile/create", {
      method: "POST",
      headers: actorHeaders,
      body: geofileCreateForm,
    }),
  );
  const geofileCreateJson = await geofileCreateResponse.json();
  assertRouteStatus("Geofile create", geofileCreateResponse.status, 201);

  const csv = [
    "Field Name,Quarter,Section,Township,Range,Meridian,Crop",
    `Route Import North ${runId},NW,28,42,4,4,barley`,
    `Route Import North ${runId},NE,28,42,4,4,barley`,
  ].join("\n");

  const previewForm = new FormData();
  previewForm.set(
    "file",
    new File([csv], "field-import.csv", {
      type: "text/csv",
    }),
  );
  const previewResponse = await previewSpreadsheet(
    new Request("http://localhost/api/field-intake/spreadsheet/preview", {
      method: "POST",
      body: previewForm,
    }),
  );
  const previewJson = await previewResponse.json();
  assertRouteStatus("Spreadsheet preview", previewResponse.status, 200);

  const saveResponse = await saveBatch(
    new Request("http://localhost/api/field-intake/spreadsheet/batches", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...actorHeaders,
      },
      body: JSON.stringify({
        preview: previewJson.result,
      }),
    }),
  );
  const saveJson = await saveResponse.json();
  assertRouteStatus("Spreadsheet batch save", saveResponse.status, 201);

  const batchId = saveJson.result.batch.id as string;
  assertPresent("Saved batch id", batchId);

  const repeatedSaveResponse = await saveBatch(
    new Request("http://localhost/api/field-intake/spreadsheet/batches", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...actorHeaders,
      },
      body: JSON.stringify({
        preview: previewJson.result,
      }),
    }),
  );
  const repeatedSaveJson = await repeatedSaveResponse.json();
  assertRouteStatus("Spreadsheet batch save replay", repeatedSaveResponse.status, 201);
  const repeatedBatchId = repeatedSaveJson.result.batch.id as string;
  assertPresent("Repeated saved batch id", repeatedBatchId);

  if (repeatedBatchId !== batchId) {
    throw new Error(
      `Spreadsheet batch save replay created ${repeatedBatchId} instead of reusing ${batchId}`,
    );
  }

  const commitResponse = await commitBatch(
    new Request(
      `http://localhost/api/field-intake/spreadsheet/batches/${batchId}/commit`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        body: JSON.stringify({
          onboardingDryRun: false,
        }),
      },
    ),
    {
      params: Promise.resolve({
        batchId,
      }),
    },
  );
  const commitJson = await commitResponse.json();
  assertRouteStatus("Spreadsheet batch commit", commitResponse.status, 200);

  const committedFieldIds =
    commitJson.result?.candidates?.map(
      (entry: { field: { id: string } }) => entry.field.id,
    ) ?? [];
  const onboardingDispatchIds =
    commitJson.result?.onboardingDispatches?.flatMap(
      (
        entry: {
          receipts: Array<{
            result: {
              id: string;
            };
          }>;
        },
      ) => entry.receipts.map((receipt) => receipt.result.id),
    ) ?? [];

  if (commitJson.result?.batch?.status !== "committed") {
    throw new Error(
      `Spreadsheet batch commit ended in unexpected status ${String(commitJson.result?.batch?.status)}`,
    );
  }

  if (committedFieldIds.length === 0) {
    throw new Error("Spreadsheet batch commit did not create any fields");
  }

  if (onboardingDispatchIds.length === 0) {
    throw new Error("Spreadsheet batch commit did not queue any onboarding dispatches");
  }

  const repeatedCommitResponse = await commitBatch(
    new Request(
      `http://localhost/api/field-intake/spreadsheet/batches/${batchId}/commit`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...actorHeaders,
        },
        body: JSON.stringify({
          onboardingDryRun: false,
        }),
      },
    ),
    {
      params: Promise.resolve({
        batchId,
      }),
    },
  );
  const repeatedCommitJson = await repeatedCommitResponse.json();
  assertRouteStatus("Spreadsheet batch commit replay", repeatedCommitResponse.status, 200);

  const repeatedCommitFieldIds =
    repeatedCommitJson.result?.candidates?.map(
      (entry: { field: { id: string } }) => entry.field.id,
    ) ?? [];

  if (repeatedCommitJson.result?.batch?.status !== "committed") {
    throw new Error(
      `Spreadsheet batch replay ended in unexpected status ${String(repeatedCommitJson.result?.batch?.status)}`,
    );
  }

  if (
    JSON.stringify(repeatedCommitFieldIds) !== JSON.stringify(committedFieldIds)
  ) {
    throw new Error(
      `Spreadsheet batch replay returned different field ids: ${JSON.stringify(repeatedCommitFieldIds)} vs ${JSON.stringify(committedFieldIds)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        workspaceId: workspace.id,
        actorStatus: actorResponse.status,
        actorWorkspaceId: actorJson.actor?.workspaceId,
        lldStatus: lldResponse.status,
        lldFieldName: lldJson.result?.draft?.name,
        lldCreateStatus: lldCreateResponse.status,
        lldCreateFieldId: lldCreateJson.result?.field?.id,
        geofileStatus: geofileResponse.status,
        geofileFieldName: geofileJson.result?.draft?.name,
        geofileCreateStatus: geofileCreateResponse.status,
        geofileCreateFieldId: geofileCreateJson.result?.field?.id,
        previewStatus: previewResponse.status,
        previewFieldCount: previewJson.result?.fieldCount,
        saveStatus: saveResponse.status,
        savedBatchId: batchId,
        repeatedSaveStatus: repeatedSaveResponse.status,
        repeatedSavedBatchId: repeatedBatchId,
        commitStatus: commitResponse.status,
        commitBatchStatus: commitJson.result?.batch?.status,
        commitFieldIds: committedFieldIds,
        repeatedCommitStatus: repeatedCommitResponse.status,
        repeatedCommitBatchStatus: repeatedCommitJson.result?.batch?.status,
        repeatedCommitFieldIds,
        queueDispatchIds: onboardingDispatchIds,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown field-intake route smoke error";
  console.error(`[field-intake-routes-smoke] ${message}`);
  process.exitCode = 1;
});
