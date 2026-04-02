import type {
  FieldHydrationReplayResult,
  ServerServices,
} from "@fieldpulse/platform-runtime";

type IntakeFieldPreparationPayload = {
  workspaceId: string;
  fieldId: string;
  fieldName?: string;
  dryRun?: boolean;
  cropType?: string;
  legalLandDescriptions?: readonly string[];
  importBatchId?: string;
  importCandidateId?: string;
  importSourceType?: "spreadsheet";
  importAction?: "created" | "reused";
};

type IntakeFieldPreparationMode = "bootstrap-initial" | "refresh-intake";

type IntakeFieldPreparationServices = Pick<
  ServerServices,
  "fieldCropContext" | "fieldIntake"
>;

export type IntakeFieldPreparationResult = {
  cropContextApplied: boolean;
  replayResult: FieldHydrationReplayResult | null;
};

function toSeasonYear(requestedAt: string) {
  return new Date(requestedAt).getUTCFullYear();
}

function buildImportMetadata(input: IntakeFieldPreparationPayload) {
  const metadata: Record<string, string> = {};

  if (input.importBatchId) {
    metadata.batchId = input.importBatchId;
  }
  if (input.importCandidateId) {
    metadata.candidateId = input.importCandidateId;
  }
  if (input.importAction) {
    metadata.commitAction = input.importAction;
  }
  if (input.importSourceType) {
    metadata.sourceType = input.importSourceType;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export async function prepareImportedFieldOnboarding(input: {
  services: IntakeFieldPreparationServices;
  payload: IntakeFieldPreparationPayload;
  requestedAt: string;
  mode: IntakeFieldPreparationMode;
}): Promise<IntakeFieldPreparationResult> {
  if (input.payload.dryRun) {
    return {
      cropContextApplied: false,
      replayResult: null,
    };
  }

  let cropContextApplied = false;
  if (input.payload.cropType) {
    await input.services.fieldCropContext.upsertFieldContext({
      workspaceId: input.payload.workspaceId,
      fieldId: input.payload.fieldId,
      seasonYear: toSeasonYear(input.requestedAt),
      cropType: input.payload.cropType,
      growthStage: null,
      growthStageSource: "imported",
      accumulatedGdd: 0,
      sourceKey: "field-intake:spreadsheet-commit",
      metadata: buildImportMetadata(input.payload),
    });
    cropContextApplied = true;
  }

  if (
    input.mode !== "bootstrap-initial" ||
    !input.payload.legalLandDescriptions ||
    input.payload.legalLandDescriptions.length === 0
  ) {
    return {
      cropContextApplied,
      replayResult: null,
    };
  }

  const replayResult = await input.services.fieldIntake.replayFieldHydration({
    workspaceId: input.payload.workspaceId,
    fieldId: input.payload.fieldId,
    fieldName: input.payload.fieldName ?? input.payload.fieldId,
    cropType: input.payload.cropType,
    legalLandDescriptions: input.payload.legalLandDescriptions,
  });

  return {
    cropContextApplied,
    replayResult,
  };
}
