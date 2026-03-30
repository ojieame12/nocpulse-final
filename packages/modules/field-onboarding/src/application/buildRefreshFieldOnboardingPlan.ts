import type {
  BuildRefreshFieldOnboardingPlanInput,
  FieldOnboardingPlan,
} from "../contracts/FieldOnboardingPlan";

export function buildRefreshFieldOnboardingPlan(
  input: BuildRefreshFieldOnboardingPlanInput,
): FieldOnboardingPlan {
  const requestedAt = input.requestedAt ?? new Date().toISOString();

  return {
    fieldId: input.fieldId,
    workspaceId: input.workspaceId,
    requestedAt,
    jobs: [{
      key: "field.refresh-intake",
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
