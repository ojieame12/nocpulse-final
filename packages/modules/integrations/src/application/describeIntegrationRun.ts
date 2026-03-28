import type { IntegrationRun } from "../contracts/IntegrationRun";

export function describeIntegrationRun(input: IntegrationRun) {
  return `${input.provider}:${input.operation} ${input.status} at ${input.occurredAt}`;
}
