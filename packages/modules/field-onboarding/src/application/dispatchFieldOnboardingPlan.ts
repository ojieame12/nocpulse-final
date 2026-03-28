import type {
  FieldOnboardingDispatchReceipt,
  FieldOnboardingDispatcher,
  FieldOnboardingPlan,
} from "../contracts/FieldOnboardingPlan";

export async function dispatchFieldOnboardingPlan(
  input: {
    dispatcher: FieldOnboardingDispatcher;
    plan: FieldOnboardingPlan;
  },
): Promise<readonly FieldOnboardingDispatchReceipt[]> {
  const receipts: FieldOnboardingDispatchReceipt[] = [];

  for (const job of input.plan.jobs) {
    const receipt = await input.dispatcher.enqueue(job);

    receipts.push({
      key: job.key,
      payload: job.payload,
      result: receipt.result,
    });
  }

  return receipts;
}
