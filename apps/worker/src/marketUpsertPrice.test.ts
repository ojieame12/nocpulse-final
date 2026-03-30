import test from "node:test";
import assert from "node:assert/strict";
import { parseCliArgs } from "./runtime/parseCliArgs";
import { runMarketUpsertPrice } from "./marketUpsertPrice";

test("runMarketUpsertPrice forwards normalized quote input to the market service", async () => {
  const calls: unknown[] = [];

  const snapshot = await runMarketUpsertPrice({
    runtime: {
      mode: "supabase",
      services: {
        market: {
          async upsertPrice(input) {
            calls.push(input);
            return {
              cropSymbol: input.cropSymbol,
              closePriceCadPerTonne: input.closePriceCadPerTonne,
              basisCadPerTonne: input.basisCadPerTonne ?? 0,
              sourceKey: input.sourceKey,
              capturedAt: input.capturedAt ?? "2026-03-28T12:00:00.000Z",
            };
          },
        },
      },
    },
    args: parseCliArgs([
      "--crop",
      "canola",
      "--price",
      "720.5",
      "--basis",
      "-12",
      "--source",
      "manual-admin",
      "--captured-at",
      "2026-03-27T00:00:00Z",
    ]),
  });

  assert.deepEqual(calls, [
    {
      cropSymbol: "CANOLA",
      closePriceCadPerTonne: 720.5,
      basisCadPerTonne: -12,
      sourceKey: "manual-admin",
      capturedAt: "2026-03-27T00:00:00Z",
    },
  ]);
  assert.equal(snapshot.cropSymbol, "CANOLA");
  assert.equal(snapshot.closePriceCadPerTonne, 720.5);
  assert.equal(snapshot.basisCadPerTonne, -12);
});

test("runMarketUpsertPrice rejects a missing crop before writing", async () => {
  await assert.rejects(
    () =>
      runMarketUpsertPrice({
        runtime: {
          mode: "supabase",
          services: {
            market: {
              async upsertPrice() {
                throw new Error("should not be called");
              },
            },
          },
        },
        args: parseCliArgs(["--price", "720.5"]),
      }),
    /\[worker-market-upsert-price\] --crop is required/,
  );
});
