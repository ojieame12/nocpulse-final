import type {
  BuildInitialFieldOnboardingPlanInput,
  FieldOnboardingPlan,
} from "../contracts/FieldOnboardingPlan";

export function buildInitialFieldOnboardingPlan(
  input: BuildInitialFieldOnboardingPlanInput,
): FieldOnboardingPlan {
  const requestedAt = input.requestedAt ?? new Date().toISOString();

  return {
    fieldId: input.fieldId,
    workspaceId: input.workspaceId,
    requestedAt,
    jobs: [{
      key: "field.bootstrap-initial",
      payload: {
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        requestedAt,
        providers: input.providers,
        dryRun: input.dryRun,
      },
    }],
  };
}
