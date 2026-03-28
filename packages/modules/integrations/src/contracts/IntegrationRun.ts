export type IntegrationRunStatus = "queued" | "running" | "succeeded" | "failed";

export type IntegrationRun = {
  id: string;
  provider: string;
  operation: string;
  status: IntegrationRunStatus;
  occurredAt: string;
};
