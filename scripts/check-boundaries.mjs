import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FILE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const IMPORT_PATTERNS = [
  /\bimport\s+[^"'`]*?\sfrom\s+["']([^"']+)["']/g,
  /\bexport\s+[^"'`]*?\sfrom\s+["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
];

const WEB_FORBIDDEN_PACKAGES = [
  "@fieldpulse/platform-db",
  "@fieldpulse/platform-storage",
  "@fieldpulse/raster",
  "@fieldpulse/pdf",
];

const IGNORED_PATH_SEGMENTS = new Set([
  "node_modules",
  ".next",
  "dist",
  ".git",
  "coverage",
  "__archive__",
]);

async function main() {
  const files = await collectSourceFiles([
    path.join(ROOT, "apps"),
    path.join(ROOT, "packages"),
  ]);

  const violations = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const specifiers = extractSpecifiers(content);
    const sourceBoundary = inferBoundary(file);

    for (const specifier of specifiers) {
      validateSpecifier({
        file,
        specifier,
        sourceBoundary,
        violations,
      });
    }
  }

  if (violations.length > 0) {
    console.error("Architecture boundary violations detected:\n");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Boundary check passed.");
}

function validateSpecifier({ file, specifier, sourceBoundary, violations }) {
  if (specifier.includes("/src/")) {
    violations.push(`${relative(file)} imports internal source path "${specifier}". Use a package public API.`);
  }

  if (
    sourceBoundary.scope === "app" &&
    sourceBoundary.name === "web" &&
    !isServerOnlyWebFile(file) &&
    WEB_FORBIDDEN_PACKAGES.some((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`))
  ) {
    violations.push(`${relative(file)} imports "${specifier}", which is forbidden in apps/web.`);
  }

  if (!specifier.startsWith(".")) {
    return;
  }

  const resolved = resolveRelativeImport(file, specifier);
  if (!resolved) {
    violations.push(`${relative(file)} has an unresolved relative import "${specifier}".`);
    return;
  }

  const targetBoundary = inferBoundary(resolved);

  if (sourceBoundary.scope === "app" && sourceBoundary.root !== targetBoundary.root) {
    violations.push(`${relative(file)} crosses out of its app root via "${specifier}". Apps may only import local files or package public APIs.`);
  }

  if (sourceBoundary.scope === "package" && sourceBoundary.root !== targetBoundary.root) {
    violations.push(`${relative(file)} crosses package boundaries via "${specifier}". Use workspace package imports instead.`);
  }

  if (targetBoundary.scope === "app" && sourceBoundary.root !== targetBoundary.root) {
    violations.push(`${relative(file)} imports app implementation "${relative(resolved)}". Packages may not depend on apps.`);
  }

  if (sourceBoundary.layer === "domain" && (targetBoundary.layer === "application" || targetBoundary.layer === "infrastructure")) {
    violations.push(`${relative(file)} is a domain file importing ${targetBoundary.layer} code via "${specifier}".`);
  }

  if (sourceBoundary.layer === "contracts" && (targetBoundary.layer === "application" || targetBoundary.layer === "infrastructure")) {
    violations.push(`${relative(file)} is a contracts file importing ${targetBoundary.layer} code via "${specifier}".`);
  }

  if (sourceBoundary.layer === "application" && targetBoundary.layer === "infrastructure") {
    violations.push(`${relative(file)} is an application file importing infrastructure code via "${specifier}".`);
  }
}

function inferBoundary(file) {
  const normalized = file.split(path.sep).join("/");
  const relativeFile = relative(file);

  if (normalized.includes("/apps/web/")) {
    return {
      scope: "app",
      name: "web",
      layer: inferLayer(relativeFile),
      root: path.join(ROOT, "apps", "web"),
    };
  }

  if (normalized.includes("/apps/worker/")) {
    return {
      scope: "app",
      name: "worker",
      layer: inferLayer(relativeFile),
      root: path.join(ROOT, "apps", "worker"),
    };
  }

  return {
    scope: "package",
    name: packageNameFromPath(normalized),
    layer: inferLayer(relativeFile),
    root: packageRootFromPath(normalized),
  };
}

function inferLayer(relativeFile) {
  if (relativeFile.includes("/src/domain/")) return "domain";
  if (relativeFile.includes("/src/application/")) return "application";
  if (relativeFile.includes("/src/infrastructure/")) return "infrastructure";
  if (relativeFile.includes("/src/contracts/")) return "contracts";
  return "root";
}

function packageNameFromPath(normalizedPath) {
  const match = normalizedPath.match(/\/packages\/([^/]+)\/([^/]+)/);
  if (match?.[1] === "modules") {
    return `@fieldpulse/module-${match[2]}`;
  }
  if (match?.[1] === "platform") {
    return `@fieldpulse/platform-${match[2]}`;
  }
  if (match?.[1]) {
    return `@fieldpulse/${match[1]}`;
  }
  return "@fieldpulse/unknown";
}

function packageRootFromPath(normalizedPath) {
  const match = normalizedPath.match(/^(.*\/packages\/(?:modules\/[^/]+|platform\/[^/]+|[^/]+))/);
  return match?.[1] ? path.normalize(match[1]) : ROOT;
}

function resolveRelativeImport(file, specifier) {
  const base = path.resolve(path.dirname(file), specifier);
  const candidateBases = new Set([base]);

  if (path.extname(base)) {
    candidateBases.add(base.slice(0, -path.extname(base).length));
  }

  for (const candidateBase of candidateBases) {
    for (const extension of ["", ...FILE_EXTENSIONS, ".js", ".jsx"]) {
      const candidate = `${candidateBase}${extension}`;
      if (existsSync(candidate)) return candidate;
    }

    for (const extension of FILE_EXTENSIONS) {
      const indexCandidate = path.join(candidateBase, `index${extension}`);
      if (existsSync(indexCandidate)) return indexCandidate;
    }
  }

  return null;
}

function extractSpecifiers(content) {
  const specifiers = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) specifiers.push(match[1]);
    }
  }
  return specifiers;
}

async function collectSourceFiles(roots) {
  const files = [];
  for (const root of roots) {
    await walk(root, files);
  }
  return files;
}

async function walk(dir, files) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".next-dev")) continue;
    if (IGNORED_PATH_SEGMENTS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, files);
      continue;
    }
    if (FILE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(fullPath);
    }
  }
}

function isServerOnlyWebFile(file) {
  const relativeFile = relative(file).split(path.sep).join("/");
  if (!relativeFile.startsWith("apps/web/")) {
    return false;
  }

  if (relativeFile.startsWith("apps/web/src/server/")) {
    return true;
  }

  return /\/src\/app\/.+\/route\.(?:ts|tsx|mts|cts)$/.test(relativeFile);
}

function relative(file) {
  return path.relative(ROOT, file) || ".";
}

await main();
