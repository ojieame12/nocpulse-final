import { loadEnvFile } from "@fieldpulse/platform-config";
import {
  createServerRuntime,
  type CreateServerRuntimeOptions,
  type ServerRuntime,
} from "@fieldpulse/platform-runtime";

let envLoaded = false;

export function getWebServerRuntime(
  options: CreateServerRuntimeOptions = {},
): ServerRuntime {
  if (!envLoaded) {
    loadEnvFile();
    envLoaded = true;
  }

  return createServerRuntime(process.env, options);
}
