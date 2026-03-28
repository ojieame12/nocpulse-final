export type JobKey = `${string}.${string}`;

export type JobProgressUpdate = {
  progressPct?: number | null;
  progressMessage?: string | null;
  phaseKey?: string | null;
  phaseLabel?: string | null;
};

export type JobExecutionControls = {
  dispatchId: string;
  attempt: number;
  workerName: string;
  reportProgress(update: JobProgressUpdate): Promise<void>;
  throwIfCancellationRequested(): Promise<void>;
};

export type RegisteredJob<
  TContext = unknown,
  TPayload = unknown,
  TResult = unknown,
> = {
  key: JobKey;
  description: string;
  run(
    context: TContext,
    payload: TPayload,
    execution: JobExecutionControls,
  ): Promise<TResult>;
  samplePayload?: (context: TContext) => Promise<TPayload> | TPayload;
};
