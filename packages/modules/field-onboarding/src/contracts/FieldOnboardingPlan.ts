import type {
  SyncLatestImageryInput,
  SyncLatestImageryResult,
} from "@fieldpulse/module-imagery";

export type BuildInitialFieldOnboardingPlanInput = Omit<
  SyncLatestImageryInput,
  "requestedAt"
> & {
  requestedAt?: string;
};

export type FieldOnboardingJobRequest = {
  key: "imagery.sync-latest";
  payload: SyncLatestImageryInput;
};

export type FieldOnboardingPlan = {
  fieldId: string;
  workspaceId: string;
  requestedAt: string;
  jobs: readonly FieldOnboardingJobRequest[];
};

export type FieldOnboardingDispatchReceipt = {
  key: FieldOnboardingJobRequest["key"];
  payload: SyncLatestImageryInput;
  result: SyncLatestImageryResult | unknown;
};

export type FieldOnboardingDispatcher = {
  enqueue(
    input: FieldOnboardingJobRequest,
  ): Promise<FieldOnboardingDispatchReceipt | { key: string; payload: unknown; result: unknown }>;
};
