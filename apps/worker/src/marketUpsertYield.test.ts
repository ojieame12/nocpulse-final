import test from "node:test";
import assert from "node:assert/strict";
import { parseCliArgs } from "./runtime/parseCliArgs";
import { runMarketUpsertYield } from "./marketUpsertYield";

test("runMarketUpsertYield forwards normalized field yield input to the market service", async () => {
  const calls: unknown[] = [];

  const assumption = await runMarketUpsertYield({
    runtime: {
      mode: "supabase",
      services: {
        market: {
          async upsertFieldYieldAssumption(input) {
            calls.push(input);
            return {
              fieldId: input.fieldId,
              cropSymbol: input.cropSymbol,
              yieldTonnesPerHa: input.yieldTonnesPerHa,
              seasonYear: input.seasonYear ?? null,
              sourceKey: input.sourceKey,
              assumedAt: input.assumedAt ?? "2026-03-28T12:00:00.000Z",
            };
          },
        },
      },
    },
    args: parseCliArgs([
      "--workspace-id",
      "workspace-123",
      "--field-id",
      "field-456",
      "--crop",
      "canola",
      "--yield",
      "2.4",
      "--season-year",
      "2026",
      "--source",
      "manual-admin",
      "--note",
      "Field manager estimate",
      "--assumed-at",
      "2026-03-28T09:00:00Z",
    ]),
  });

  assert.deepEqual(calls, [
    {
      workspaceId: "workspace-123",
      fieldId: "field-456",
      seasonYear: 2026,
      cropSymbol: "CANOLA",
      yieldTonnesPerHa: 2.4,
      sourceKey: "manual-admin",
      noteText: "Field manager estimate",
      assumedAt: "2026-03-28T09:00:00Z",
    },
  ]);
  assert.equal(assumption.cropSymbol, "CANOLA");
  assert.equal(assumption.yieldTonnesPerHa, 2.4);
  assert.equal(assumption.seasonYear, 2026);
});

test("runMarketUpsertYield rejects a non-positive yield before writing", async () => {
  await assert.rejects(
    () =>
      runMarketUpsertYield({
        runtime: {
          mode: "supabase",
          services: {
            market: {
              async upsertFieldYieldAssumption() {
                throw new Error("should not be called");
              },
            },
          },
        },
        args: parseCliArgs([
          "--workspace-id",
          "workspace-123",
          "--field-id",
          "field-456",
          "--yield",
          "0",
        ]),
      }),
    /\[worker-market-upsert-yield\] --yield-tonnes-per-ha must be a positive number/,
  );
});
