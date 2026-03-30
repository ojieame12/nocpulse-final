import { existsSync, readFileSync } from "fs";
import path from "path";

type LoadEnvFileOptions = {
  startDir?: string;
  fileName?: string;
  override?: boolean;
};

function populateEnv(
  envPath: string,
  override: boolean,
) {
  const content = readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!override && process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value;
  }
}

export function loadEnvFile(options: LoadEnvFileOptions = {}) {
  const fileName = options.fileName ?? ".env";
  const override = options.override ?? false;
  let currentDir = options.startDir ?? process.cwd();

  while (true) {
    const envPath = path.join(currentDir, fileName);
    if (existsSync(envPath)) {
      populateEnv(envPath, override);
      return envPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}
