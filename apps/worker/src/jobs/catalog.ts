import { createJobCatalog, type AnyRegisteredJob } from "@fieldpulse/platform-jobs";
import { jobs } from "./registry";
import type { WorkerJobContext } from "./contracts/WorkerJobContext";

export const jobCatalog = createJobCatalog(
  jobs as readonly AnyRegisteredJob<WorkerJobContext>[],
);
