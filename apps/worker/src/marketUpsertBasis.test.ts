import test from "node:test";
import assert from "node:assert/strict";
import { parseCliArgs } from "./runtime/parseCliArgs";
import { runMarketUpsertBasis } from "./marketUpsertBasis";

test("runMarketUpsertBasis forwards normalized field basis input to the market service", async () => {
  const calls: unknown[] = [];

  const assumption = await runMarketUpsertBasis({
    runtime: {
      mode: "supabase",
      services: {
        market: {
          async upsertFieldBasisAssumption(input) {
            calls.push(input);
            return {
              fieldId: input.fieldId,
              cropSymbol: input.cropSymbol,
              basisCadPerTonne: input.basisCadPerTonne,
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
      "--basis",
      "-12",
      "--season-year",
      "2026",
      "--source",
      "manual-admin",
      "--note",
      "Local elevator bid",
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
      basisCadPerTonne: -12,
      sourceKey: "manual-admin",
      noteText: "Local elevator bid",
      assumedAt: "2026-03-28T09:00:00Z",
    },
  ]);
  assert.equal(assumption.cropSymbol, "CANOLA");
  assert.equal(assumption.basisCadPerTonne, -12);
  assert.equal(assumption.seasonYear, 2026);
});

test("runMarketUpsertBasis rejects a missing workspace id before writing", async () => {
  await assert.rejects(
    () =>
      runMarketUpsertBasis({
        runtime: {
          mode: "supabase",
          services: {
            market: {
              async upsertFieldBasisAssumption() {
                throw new Error("should not be called");
              },
            },
          },
        },
        args: parseCliArgs([
          "--field-id",
          "field-456",
          "--crop",
          "canola",
          "--basis-cad-per-tonne",
          "-8",
        ]),
      }),
    /\[worker-market-upsert-basis\] --workspace-id is required/,
  );
});
