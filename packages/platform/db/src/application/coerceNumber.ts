export function coerceNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}
