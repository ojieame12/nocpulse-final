export function readRequestedAt(raw: string | undefined, label: string) {
  if (!raw) {
    return new Date().toISOString();
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`[${label}] invalid --requested-at value "${raw}"`);
  }

  return parsed.toISOString();
}
