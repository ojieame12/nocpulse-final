import type { AnyRegisteredJob, JobCatalog } from "../contracts/JobCatalog";
import type { JobKey } from "../contracts/RegisteredJob";

export function createJobCatalog<TContext>(
  jobs: readonly AnyRegisteredJob<TContext>[],
): JobCatalog<TContext> {
  const jobsByKey = new Map<JobKey, AnyRegisteredJob<TContext>>();

  for (const job of jobs) {
    jobsByKey.set(job.key, job);
  }

  return {
    listJobs() {
      return jobs;
    },
    getJob(key) {
      return jobsByKey.get(key) ?? null;
    },
  };
}
