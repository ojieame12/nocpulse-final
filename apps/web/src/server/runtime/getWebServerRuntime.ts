import { loadEnvFile } from "@fieldpulse/platform-config";
import {
  createServerRuntime,
  type CreateServerRuntimeOptions,
  type ServerRuntime,
} from "@fieldpulse/platform-runtime";
import { installServerCrashLogging } from "./installServerCrashLogging";

let envLoaded = false;

export function getWebServerRuntime(
  options: CreateServerRuntimeOptions = {},
): ServerRuntime {
  installServerCrashLogging();

  if (!envLoaded) {
    loadEnvFile();
    envLoaded = true;
  }

  return createServerRuntime(process.env, options);
}
