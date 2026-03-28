import { loadWorkerEnv } from "./runtime/loadEnv";
import { bootWorker } from "./runtime/bootWorker";

loadWorkerEnv();

bootWorker().catch((error) => {
  console.error("[worker] fatal", error);
  process.exitCode = 1;
});
