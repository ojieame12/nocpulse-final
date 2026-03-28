export type ParsedCliArgs = {
  readonly flags: ReadonlyMap<string, string | true>;
  readonly positionals: readonly string[];
};

export function parseCliArgs(argv = process.argv.slice(2)): ParsedCliArgs {
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const [flag, inlineValue] = token.slice(2).split("=", 2);

    if (inlineValue !== undefined) {
      flags.set(flag, inlineValue);
      continue;
    }

    const next = argv[index + 1];

    if (next && !next.startsWith("--")) {
      flags.set(flag, next);
      index += 1;
      continue;
    }

    flags.set(flag, true);
  }

  return {
    flags,
    positionals,
  };
}

export function readStringFlag(
  args: ParsedCliArgs,
  name: string,
): string | undefined {
  const value = args.flags.get(name);

  return typeof value === "string" ? value : undefined;
}

export function readBooleanFlag(
  args: ParsedCliArgs,
  name: string,
): boolean {
  return args.flags.get(name) === true;
}

export function readNumberFlag(
  args: ParsedCliArgs,
  name: string,
): number | undefined {
  const value = readStringFlag(args, name);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`[worker-cli] --${name} must be a valid number`);
  }

  return parsed;
}

export function readCsvFlag(
  args: ParsedCliArgs,
  name: string,
): readonly string[] {
  const value = readStringFlag(args, name);

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
