import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAppEearsPointTaskRequest,
  createAppEearsSmapSource,
  parseAppEearsPointCsv,
} from "./createAppEearsClient";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function createMockFetch(
  responses: Array<
    | Response
    | ((input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>)
  >,
) {
  const calls: FetchCall[] = [];
  let index = 0;

  const fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });

    const response = responses[index];
    index += 1;

    if (!response) {
      throw new Error(`unexpected fetch call ${index} for ${url}`);
    }

    if (typeof response === "function") {
      return response(input, init);
    }

    return response;
  };

  return {
    calls,
    fetch: fetch as typeof globalThis.fetch,
  };
}

function approxEqual(actual: number, expected: number, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("buildAppEearsPointTaskRequest uses current SMAP product and layer", () => {
  const request = buildAppEearsPointTaskRequest({
    lat: 52.12345,
    lng: -110.54321,
    startDate: "2026-01-01",
    endDate: "2026-03-31",
  });

  assert.equal(request.task_type, "point");
  assert.equal(request.params.layers.length, 1);
  assert.deepEqual(request.params.layers[0], {
    product: "SPL4SMGP.008",
    layer: "Geophysical_Data_sm_rootzone",
  });
  assert.deepEqual(request.params.dates[0], {
    startDate: "01-01-2026",
    endDate: "03-31-2026",
    recurring: false,
  });
  assert.equal(request.params.output.format.type, "geotiff");
  assert.equal(request.params.coordinates[0]?.latitude, 52.12345);
  assert.equal(request.params.coordinates[0]?.longitude, -110.54321);
});

test("parseAppEearsPointCsv parses the current SMAP root-zone column and converts fraction to percent", () => {
  const csv = [
    "date,latitude,longitude,Geophysical_Data_sm_rootzone",
    "2026-03-29,52.1,-110.2,0.312",
    "2026-03-30,52.1,-110.2,0.298",
    "2026-03-31,52.1,-110.2,-9999",
  ].join("\n");

  const observations = parseAppEearsPointCsv(
    csv,
    "2026-03-29",
    "2026-03-31",
  );

  assert.equal(observations.length, 2);
  assert.equal(observations[0]?.date, "2026-03-29");
  approxEqual(observations[0]!.rootZonePct, 31.2);
  assert.equal(observations[1]?.date, "2026-03-30");
  approxEqual(observations[1]!.rootZonePct, 29.8);
});

test("parseAppEearsPointCsv falls back to the sole numeric data column", () => {
  const csv = [
    "Date,Latitude,Longitude,category,root_zone_sm_pct",
    "2026-03-29,52.1,-110.2,field,32.4",
    "2026-03-30,52.1,-110.2,field,31.8",
  ].join("\n");

  const observations = parseAppEearsPointCsv(
    csv,
    "2026-03-29",
    "2026-03-30",
  );

  assert.deepEqual(observations, [
    { date: "2026-03-29", rootZonePct: 32.4 },
    { date: "2026-03-30", rootZonePct: 31.8 },
  ]);
});

test("createAppEearsSmapSource completes the login-submit-poll-download flow", async () => {
  const csv = [
    "date,Geophysical_Data_sm_rootzone",
    "2026-03-29,0.25",
    "2026-03-30,0.30",
  ].join("\n");

  const { calls, fetch } = createMockFetch([
    new Response(
      JSON.stringify({
        token_type: "Bearer",
        token: "test-token",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    ),
    new Response(
      JSON.stringify({
        task_id: "task-123",
        status: "pending",
      }),
      {
        status: 202,
        headers: { "content-type": "application/json" },
      },
    ),
    new Response(
      JSON.stringify({
        task_id: "task-123",
        status: "done",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    ),
    new Response(
      JSON.stringify({
        files: [
          {
            file_id: "file-456",
            file_name: "Point-SPL4SMGP.008-results.csv",
            file_type: "csv",
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    ),
    new Response(csv, {
      status: 200,
      headers: { "content-type": "text/csv" },
    }),
  ]);

  const source = createAppEearsSmapSource("user", "pass", {
    baseUrl: "https://appeears.example.test/api",
    fetchImpl: fetch,
    pollIntervalMs: 0,
    taskTimeoutMs: 10_000,
  });

  const observations = await source.fetchSmapTimeseries(
    52.1,
    -110.2,
    "2026-03-29",
    "2026-03-30",
  );

  assert.deepEqual(observations, [
    { date: "2026-03-29", rootZonePct: 25 },
    { date: "2026-03-30", rootZonePct: 30 },
  ]);

  assert.equal(calls.length, 5);
  assert.equal(calls[0]?.url, "https://appeears.example.test/api/login");
  assert.match(
    String(
      (calls[0]?.init?.headers as Record<string, string> | undefined)
        ?.authorization,
    ),
    /^Basic /,
  );
  assert.equal(calls[1]?.url, "https://appeears.example.test/api/task");
  assert.equal(calls[2]?.url, "https://appeears.example.test/api/task/task-123");
  assert.equal(calls[3]?.url, "https://appeears.example.test/api/bundle/task-123");
  assert.equal(
    calls[4]?.url,
    "https://appeears.example.test/api/bundle/task-123/file-456",
  );
});
