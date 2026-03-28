import type { RegisteredJob } from "../contracts/RegisteredJob";

export function createRegisteredJob<
  TContext,
  TPayload,
  TResult,
>(
  job: RegisteredJob<TContext, TPayload, TResult>,
): RegisteredJob<TContext, TPayload, TResult> {
  return job;
}
