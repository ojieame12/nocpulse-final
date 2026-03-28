import type { JobExecutionControls } from "../contracts/RegisteredJob";

export type JobPhase<TState> = {
  key: string;
  label?: string;
  progressPct: number;
  progressMessage: string;
  run(state: TState): Promise<TState> | TState;
};

export async function runJobPhases<TState>(
  execution: JobExecutionControls,
  input: {
    initialState: TState;
    phases: readonly JobPhase<TState>[];
  },
): Promise<TState> {
  let state = input.initialState;

  for (const phase of input.phases) {
    await execution.throwIfCancellationRequested();
    await execution.reportProgress({
      phaseKey: phase.key,
      phaseLabel: phase.label ?? phase.progressMessage,
      progressPct: phase.progressPct,
      progressMessage: phase.progressMessage,
    });

    state = await phase.run(state);
    await execution.throwIfCancellationRequested();
  }

  return state;
}
