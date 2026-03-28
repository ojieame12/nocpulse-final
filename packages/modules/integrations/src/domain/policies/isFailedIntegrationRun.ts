import type { IntegrationRun } from "../../contracts/IntegrationRun";

export function isFailedIntegrationRun(input: IntegrationRun) {
  return input.status === "failed";
}
