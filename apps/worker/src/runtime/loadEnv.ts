import { loadEnvFile } from "@fieldpulse/platform-config";

export function loadWorkerEnv() {
  const envPath = loadEnvFile({ startDir: process.cwd() });
  const envLocalPath = loadEnvFile({
    startDir: process.cwd(),
    fileName: ".env.local",
    override: true,
  });
  return envLocalPath ?? envPath;
}
