import { describeImageryCapability } from "@fieldpulse/module-imagery";
import { describeMoistureEstimate } from "@fieldpulse/module-moisture";
import { createLogger } from "@fieldpulse/platform-observability";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { createWorkerJobQueue } from "./createWorkerJobQueue";

export async function bootWorker() {
  const logger = createLogger("worker");
  const runtime = createServerRuntime(process.env);
  const queue = createWorkerJobQueue();
  let workspaceProbeCount: number | null = null;

  if (runtime.mode === "supabase") {
    const probeUserId = "00000000-0000-0000-0000-000000000000";
    const workspaces = await runtime.services.workspaces.listForUser(probeUserId);
    workspaceProbeCount = workspaces.length;
  }

  logger.info("boot", {
    app: runtime.env.publicAppName,
    nodeEnv: runtime.env.nodeEnv,
    jobs: queue.listJobs().map((job) => job.key),
    queue: "persistent-db",
    imagery: describeImageryCapability("worker orchestration ready"),
    moisture: describeMoistureEstimate({
      rootZonePct: 27.1,
      surfacePct: 18.2,
      confidence: "medium",
    }),
    dataRuntime: runtime.mode,
    supabaseProjectRef: runtime.env.supabase.projectRef,
    workspaceProbeCount,
  });
}
