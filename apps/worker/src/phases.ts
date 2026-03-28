import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const dispatchId = readStringFlag(args, "id");
  const attempt = readNumberFlag(args, "attempt");
  const asJson = readBooleanFlag(args, "json");

  if (!dispatchId) {
    throw new Error("[worker-phases] --id is required");
  }

  const phaseRuns = await queue.listPhaseRuns({
    dispatchId,
    attempt,
  });

  if (asJson) {
    console.log(JSON.stringify(phaseRuns, null, 2));
    return;
  }

  if (phaseRuns.length === 0) {
    console.log("No phase runs matched the current filters.");
    return;
  }

  console.table(phaseRuns.map((phase) => ({
    id: phase.id,
    attempt: phase.attempt,
    phaseKey: phase.phaseKey,
    phaseLabel: phase.phaseLabel,
    status: phase.status,
    startedAt: phase.startedAt,
    endedAt: phase.endedAt ?? "",
    durationMs: phase.durationMs ?? "",
    latestProgressPct: phase.latestProgressPct ?? "",
    latestProgressMessage: phase.latestProgressMessage ?? "",
    workerName: phase.workerName ?? "",
  })));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown phase history failure";
  console.error(message);
  process.exitCode = 1;
});
