import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseFieldYieldAssumptionRepository } from "./createSupabaseFieldYieldAssumptionRepository";

test("latest filters to null crop_symbol when no crop symbol is requested", async () => {
  const operations: Array<[string, unknown, unknown?]> = [];

  const client = {
    from(table: string) {
      assert.equal(table, "field_yield_assumptions");

      return {
        select(columns: string) {
          operations.push(["select", columns]);
          return this;
        },
        eq(column: string, value: unknown) {
          operations.push(["eq", column, value]);
          return this;
        },
        is(column: string, value: unknown) {
          operations.push(["is", column, value]);
          return this;
        },
        order(column: string, options: unknown) {
          operations.push(["order", column, options]);
          return this;
        },
        limit(value: number) {
          operations.push(["limit", value]);
          return this;
        },
        async maybeSingle() {
          return { data: null, error: null };
        },
      };
    },
  };

  const repository = createSupabaseFieldYieldAssumptionRepository(client as never);

  const assumption = await repository.latest("workspace-1", "field-1", 2026, null);

  assert.equal(assumption, null);
  assert.deepEqual(
    operations.filter(([op]) => op === "is"),
    [["is", "crop_symbol", null]],
  );
});
