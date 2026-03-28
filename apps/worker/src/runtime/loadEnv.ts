import { loadEnvFile } from "@fieldpulse/platform-config";

export function loadWorkerEnv() {
  return loadEnvFile({ startDir: process.cwd() });
}
