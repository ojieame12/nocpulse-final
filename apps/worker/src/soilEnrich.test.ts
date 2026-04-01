import test from "node:test";
import assert from "node:assert/strict";
import {
  enrichFieldSoilProperties,
  type SoilEnrichDeps,
  type SoilEnrichInput,
} from "./soilEnrich";
import type { SoilPropertiesProvider, PerDepthSoilProperties } from "@fieldpulse/module-soil";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function createMockDb(options: {
  existingRow?: { soil_properties_fetched_at: string | null } | null;
  upsertError?: { message: string } | null;
} = {}) {
  const upsertedRows: unknown[] = [];

  return {
    client: {
      from(table: string) {
        return {
          select(columns: string) {
            return {
              eq(_col: string, _val: string) {
                return {
                  async maybeSingle() {
                    return {
                      data: options.existingRow ?? null,
                      error: null,
                    };
                  },
                };
              },
            };
          },
          upsert(row: unknown, _opts?: unknown) {
            upsertedRows.push(row);
            return Promise.resolve({
              error: options.upsertError ?? null,
            });
          },
        };
      },
    } as unknown as SoilEnrichDeps["db"],
    upsertedRows,
  };
}

function createMockProvider(
  result: PerDepthSoilProperties | null = null,
  shouldThrow = false,
): SoilPropertiesProvider {
  return {
    async query(_lat: number, _lng: number) {
      if (shouldThrow) {
        throw new Error("WCS service unavailable");
      }
      return result;
    },
  };
}

function createMockLogger() {
  const messages: Array<{ level: string; message: string }> = [];
  return {
    logger: {
      info(msg: string) {
        messages.push({ level: "info", message: msg });
      },
      warn(msg: string) {
        messages.push({ level: "warn", message: msg });
      },
    },
    messages,
  };
}

const SAMPLE_INPUT: SoilEnrichInput = {
  fieldId: "field-001",
  centroidLat: 51.5,
  centroidLng: -110.3,
};

const SAMPLE_SOIL_RESULT: PerDepthSoilProperties = {
  fc: { "0-5cm": 28.1, "5-15cm": 29.3, "15-30cm": 30.0 },
  wp: { "0-5cm": 14.2, "5-15cm": 15.1, "15-30cm": 15.8 },
  aggregateFcPct: 29.2,
  aggregateWpPct: 15.0,
  providerPath: "wcs",
  samplingMethod: "mean",
  pixelCount: 4,
};

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

test("enrichFieldSoilProperties skips fields with existing soil properties", async () => {
  const { client } = createMockDb({
    existingRow: { soil_properties_fetched_at: "2026-01-15T12:00:00.000Z" },
  });
  const provider = createMockProvider(SAMPLE_SOIL_RESULT);
  const { logger } = createMockLogger();

  const result = await enrichFieldSoilProperties(SAMPLE_INPUT, {
    db: client,
    soilProvider: provider,
    logger,
  });

  assert.equal(result.action, "skipped");
  assert.equal(result.reason, "already-enriched");
  assert.equal(result.fieldId, "field-001");
});

test("enrichFieldSoilProperties writes results to correct table columns", async () => {
  const { client, upsertedRows } = createMockDb({ existingRow: null });
  const provider = createMockProvider(SAMPLE_SOIL_RESULT);
  const { logger } = createMockLogger();

  const result = await enrichFieldSoilProperties(SAMPLE_INPUT, {
    db: client,
    soilProvider: provider,
    logger,
  });

  assert.equal(result.action, "enriched");
  assert.equal(result.fieldId, "field-001");

  assert.equal(upsertedRows.length, 1);
  const row = upsertedRows[0] as Record<string, unknown>;
  assert.equal(row.field_id, "field-001");
  assert.equal(row.field_capacity_pct, 29.2);
  assert.equal(row.wilting_point_pct, 15.0);
  assert.ok(row.soil_properties_fetched_at);
  assert.ok(row.updated_at);
});

test("enrichFieldSoilProperties handles provider failure gracefully", async () => {
  const { client, upsertedRows } = createMockDb({ existingRow: null });
  const provider = createMockProvider(null, true);
  const { logger, messages } = createMockLogger();

  const result = await enrichFieldSoilProperties(SAMPLE_INPUT, {
    db: client,
    soilProvider: provider,
    logger,
  });

  assert.equal(result.action, "failed");
  assert.equal(result.reason, "WCS service unavailable");
  assert.equal(upsertedRows.length, 0);
  assert.ok(
    messages.some(
      (m) => m.level === "warn" && m.message.includes("provider failure"),
    ),
  );
});

test("enrichFieldSoilProperties handles provider returning null", async () => {
  const { client, upsertedRows } = createMockDb({ existingRow: null });
  const provider = createMockProvider(null, false);
  const { logger, messages } = createMockLogger();

  const result = await enrichFieldSoilProperties(SAMPLE_INPUT, {
    db: client,
    soilProvider: provider,
    logger,
  });

  assert.equal(result.action, "failed");
  assert.equal(result.reason, "provider-returned-null");
  assert.equal(upsertedRows.length, 0);
  assert.ok(
    messages.some(
      (m) => m.level === "warn" && m.message.includes("returned null"),
    ),
  );
});

test("enrichFieldSoilProperties handles database upsert failure", async () => {
  const { client } = createMockDb({
    existingRow: null,
    upsertError: { message: "unique constraint violation" },
  });
  const provider = createMockProvider(SAMPLE_SOIL_RESULT);
  const { logger, messages } = createMockLogger();

  const result = await enrichFieldSoilProperties(SAMPLE_INPUT, {
    db: client,
    soilProvider: provider,
    logger,
  });

  assert.equal(result.action, "failed");
  assert.equal(result.reason, "unique constraint violation");
  assert.ok(
    messages.some(
      (m) => m.level === "warn" && m.message.includes("upsert error"),
    ),
  );
});

test("enrichFieldSoilProperties skips when fetched_at is null (row exists but not fetched)", async () => {
  const { client, upsertedRows } = createMockDb({
    existingRow: { soil_properties_fetched_at: null },
  });
  const provider = createMockProvider(SAMPLE_SOIL_RESULT);
  const { logger } = createMockLogger();

  const result = await enrichFieldSoilProperties(SAMPLE_INPUT, {
    db: client,
    soilProvider: provider,
    logger,
  });

  // A row with null fetched_at should proceed to enrich
  assert.equal(result.action, "enriched");
  assert.equal(upsertedRows.length, 1);
});
