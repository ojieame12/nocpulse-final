import test from "node:test";
import assert from "node:assert/strict";
import { buildLandingMarketIntelligence } from "./buildLandingMarketIntelligence";

test("buildLandingMarketIntelligence summarizes stored market snapshots", async () => {
  const viewModel = await buildLandingMarketIntelligence({
    mode: "supabase",
    services: {
      market: {
        async latestPrice({ cropSymbol }: { cropSymbol: string }) {
          if (cropSymbol === "CANOLA") {
            return {
              id: "snap-canola",
              cropSymbol,
              closePriceCadPerTonne: 727.1,
              basisCadPerTonne: 0,
              sourceCurrency: "CAD",
              sourceUnit: "tonne",
              sourceClosePrice: 727.1,
              fxRateToCad: 1,
              sourceKey: "investing-canada:ice-canola-futures",
              capturedAt: "2026-04-02T00:00:00Z",
              createdAt: "2026-04-03T12:00:00Z",
            };
          }

          return null;
        },
      },
    },
  } as any);

  assert.match(viewModel.subtitle, /Stored commodity snapshots/i);
  assert.equal(viewModel.leftLabel, "Canola Snapshot");
  assert.equal(viewModel.leftValue, "$727.10");
  assert.equal(viewModel.leftUnit, "CAD / tonne");
  assert.match(viewModel.leftSubLabel, /Fresh/i);
  assert.equal(viewModel.rightLabel, "Coverage");
  assert.equal(viewModel.rightValue, "1 / 5");
  assert.equal(viewModel.rightUnit, "feeds fresh");
  assert.equal(viewModel.rightSubLabel, "1 stored snapshots");
});

test("buildLandingMarketIntelligence returns a runtime-unavailable fallback when supabase is off", async () => {
  const viewModel = await buildLandingMarketIntelligence({
    mode: "memory",
  } as any);

  assert.match(viewModel.subtitle, /Supabase runtime is configured/i);
  assert.equal(viewModel.leftValue, "—");
  assert.equal(viewModel.rightValue, "0 / 5");
});
