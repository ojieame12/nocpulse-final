import type { ImageryProvider } from "@fieldpulse/module-imagery";

export type FieldOnboardingJobPayload = {
  workspaceId: string;
  fieldId: string;
  fieldName?: string;
  requestedAt?: string;
  providers?: readonly ImageryProvider[];
  dryRun?: boolean;
  cropType?: string;
  legalLandDescriptions?: readonly string[];
  importBatchId?: string;
  importCandidateId?: string;
  importSourceType?: "spreadsheet";
  importAction?: "created" | "reused";
};

export type BuildInitialFieldOnboardingPlanInput = FieldOnboardingJobPayload;
export type BuildRefreshFieldOnboardingPlanInput = FieldOnboardingJobPayload;

export type FieldOnboardingJobKey =
  | "field.bootstrap-initial"
  | "field.refresh-intake";

export type FieldOnboardingJobRequest = {
  key: FieldOnboardingJobKey;
  payload: FieldOnboardingJobPayload;
};

export type FieldOnboardingPlan = {
  fieldId: string;
  workspaceId: string;
  requestedAt: string;
  jobs: readonly FieldOnboardingJobRequest[];
};

export type FieldOnboardingDispatchReceipt = {
  key: FieldOnboardingJobRequest["key"];
  payload: FieldOnboardingJobPayload;
  result: unknown;
};

export type FieldOnboardingDispatcher = {
  enqueue(
    input: FieldOnboardingJobRequest,
  ): Promise<FieldOnboardingDispatchReceipt | { key: string; payload: unknown; result: unknown }>;
};
