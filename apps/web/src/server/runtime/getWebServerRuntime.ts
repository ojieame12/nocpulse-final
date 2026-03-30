import { loadEnvFile } from "@fieldpulse/platform-config";
import {
  createServerRuntime,
  type CreateServerRuntimeOptions,
  type ServerRuntime,
} from "@fieldpulse/platform-runtime";
import { installServerCrashLogging } from "./installServerCrashLogging";

let envLoaded = false;
let cachedDefaultRuntime: ServerRuntime | null = null;
let cachedPersistentRuntime: ServerRuntime | null = null;

export function getWebServerRuntime(
  options: CreateServerRuntimeOptions = {},
): ServerRuntime {
  installServerCrashLogging();

  if (!envLoaded) {
    loadEnvFile();
    envLoaded = true;
  }

  // Most web requests use one of two stable runtime shapes: the default
  // read-only runtime and the persistent-dispatcher variant used by intake
  // mutations. Reusing them avoids rebuilding repository/provider graphs on
  // every request while preserving support for custom dispatchers.
  if (options.jobDispatcher === undefined) {
    cachedDefaultRuntime ??= createServerRuntime(process.env);
    return cachedDefaultRuntime;
  }

  if (options.jobDispatcher === "persistent") {
    cachedPersistentRuntime ??= createServerRuntime(process.env, {
      jobDispatcher: "persistent",
    });
    return cachedPersistentRuntime;
  }

  return createServerRuntime(process.env, options);
}
