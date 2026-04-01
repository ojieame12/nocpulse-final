import { existsSync, readFileSync } from "fs";
import path from "path";

type LoadEnvFileOptions = {
  startDir?: string;
  fileName?: string;
  override?: boolean;
};

function normalizeEnvValue(rawValue: string) {
  let value = rawValue.trim();

  while (
    value.length >= 2 &&
    ((value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

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
    const value = normalizeEnvValue(line.slice(separatorIndex + 1));

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
