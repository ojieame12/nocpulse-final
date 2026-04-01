/**
 * Interface for fetching NASA SMAP L4 root-zone soil moisture data.
 *
 * The production implementation will use the AppEEARS (Application for
 * Extracting and Exploring Analysis Ready Samples) REST API, which
 * requires NASA Earthdata credentials and async task polling (tasks
 * typically take 5-15 minutes to complete).
 *
 * For initial development and CI usage, a CSV fixture loader is provided
 * that reads pre-downloaded SMAP data from local files.
 */

const DEFAULT_APPEEARS_BASE_URL =
  "https://appeears.earthdatacloud.nasa.gov/api";
const DEFAULT_APPEEARS_PRODUCT = "SPL4SMGP.008";
const DEFAULT_APPEEARS_LAYER = "Geophysical_Data_sm_rootzone";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_TASK_TIMEOUT_MS = 20 * 60_000;
const DEFAULT_POLL_INTERVAL_MS = 10_000;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export type SmapObservation = {
  date: string; // ISO date string (YYYY-MM-DD)
  rootZonePct: number; // Volumetric water content (%)
};

export type SmapDataSource = {
  /**
   * Fetch SMAP root-zone soil moisture for a given coordinate and date range.
   *
   * @param lat  Latitude of the point (WGS84)
   * @param lng  Longitude of the point (WGS84)
   * @param startDate  Start of the date range (YYYY-MM-DD)
   * @param endDate    End of the date range (YYYY-MM-DD)
   * @returns Array of daily observations within the date range
   */
  fetchSmapTimeseries(
    lat: number,
    lng: number,
    startDate: string,
    endDate: string,
  ): Promise<SmapObservation[]>;
};

export type CreateAppEearsSmapSourceOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  taskTimeoutMs?: number;
  productAndVersion?: string;
  layer?: string;
};

type AppEearsLoginResponse = {
  token?: string;
  token_type?: string;
  expiration?: string;
  message?: string;
};

type AppEearsTaskResponse = {
  task_id?: string;
  status?: string;
  message?: string;
};

type AppEearsTaskRecord = {
  task_id?: string;
  status?: string;
  error?: unknown;
  completed?: string | null;
  updated?: string;
  params?: unknown;
  task_name?: string;
};

type AppEearsBundleResponse = {
  files?: Array<{
    file_id?: string;
    file_name?: string;
    file_type?: string;
  }>;
};

type AppEearsPointTaskRequest = {
  task_type: "point";
  task_name: string;
  params: {
    dates: Array<{
      startDate: string;
      endDate: string;
      recurring: false;
    }>;
    layers: Array<{
      product: string;
      layer: string;
    }>;
    output: {
      format: {
        type: "geotiff";
      };
    };
    coordinates: Array<{
      id: string;
      category: string;
      latitude: number;
      longitude: number;
    }>;
  };
};

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function normalizeBaseUrl(baseUrl?: string) {
  return (baseUrl ?? DEFAULT_APPEEARS_BASE_URL).replace(/\/+$/, "");
}

function buildBasicAuthHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function formatAppEearsDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    throw new Error(
      `[smap-validation] invalid ISO date for AppEEARS request: ${isoDate}`,
    );
  }

  return `${month}-${day}-${year}`;
}

function createAppEearsTaskName(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
) {
  return [
    "fieldpulse-smap",
    startDate,
    endDate,
    lat.toFixed(5),
    lng.toFixed(5),
    Date.now(),
  ].join("-");
}

export function buildAppEearsPointTaskRequest(input: {
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
  productAndVersion?: string;
  layer?: string;
}): AppEearsPointTaskRequest {
  return {
    task_type: "point",
    task_name: createAppEearsTaskName(
      input.lat,
      input.lng,
      input.startDate,
      input.endDate,
    ),
    params: {
      dates: [
        {
          startDate: formatAppEearsDate(input.startDate),
          endDate: formatAppEearsDate(input.endDate),
          recurring: false,
        },
      ],
      layers: [
        {
          product: input.productAndVersion ?? DEFAULT_APPEEARS_PRODUCT,
          layer: input.layer ?? DEFAULT_APPEEARS_LAYER,
        },
      ],
      output: {
        format: {
          type: "geotiff",
        },
      },
      coordinates: [
        {
          id: "fieldpulse-point",
          category: "fieldpulse",
          latitude: input.lat,
          longitude: input.lng,
        },
      ],
    },
  };
}

function parseErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  if ("error" in payload) {
    const { error } = payload as { error?: unknown };
    if (typeof error === "string") {
      return error;
    }
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string") {
        return message;
      }
    }
  }

  return null;
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function parseJsonSafely(raw: string) {
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function fetchWithRetry(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  options: {
    timeoutMs: number;
    retries?: number;
  },
) {
  const retries = Math.max(0, options.retries ?? 2);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort("AppEEARS request timed out");
    }, options.timeoutMs);

    try {
      const response = await fetchImpl(input, {
        ...init,
        signal: controller.signal,
      });

      if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt === retries) {
        return response;
      }

      const body = await readResponseText(response);
      lastError = new Error(
        `[smap-validation] AppEEARS request failed with ${response.status}${
          body.trim() ? `: ${body.trim().slice(0, 240)}` : ""
        }`,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === retries) {
        throw lastError;
      }
    } finally {
      globalThis.clearTimeout(timeoutId);
    }

    await sleep(250 * (attempt + 1));
  }

  throw lastError ?? new Error("[smap-validation] AppEEARS request failed.");
}

async function fetchJson<T>(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  options: {
    timeoutMs: number;
    retries?: number;
    action: string;
  },
) {
  const response = await fetchWithRetry(fetchImpl, input, init, options);
  const raw = await readResponseText(response);

  if (!response.ok) {
    const parsed = parseJsonSafely(raw);
    const message = parseErrorMessage(parsed) ?? raw.trim().slice(0, 240);
    throw new Error(
      `[smap-validation] ${options.action} failed with ${response.status}${
        message ? `: ${message}` : ""
      }`,
    );
  }

  const parsed = parseJsonSafely(raw);
  if (!parsed) {
    throw new Error(
      `[smap-validation] ${options.action} returned an empty or non-JSON response.`,
    );
  }

  return parsed as T;
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvRows(raw: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((currentRow) =>
    currentRow.some((value) => value.trim().length > 0),
  );
}

function normalizeObservationDate(rawDate: string) {
  const value = rawDate.trim();
  if (!value) {
    return null;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const mdyMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`;
  }

  return null;
}

function normalizeRootZonePercent(rawValue: number) {
  if (!Number.isFinite(rawValue) || rawValue <= -9000) {
    return null;
  }

  if (rawValue >= 0 && rawValue <= 1.5) {
    return rawValue * 100;
  }

  return rawValue;
}

function selectDateColumnIndex(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const exact = normalized.findIndex(
    (header) =>
      header === "date" ||
      header === "time" ||
      header === "acquisition_date" ||
      header.endsWith("_date"),
  );

  if (exact >= 0) {
    return exact;
  }

  return normalized.findIndex((header) => header.includes("date"));
}

function selectValueColumnIndex(headers: string[], rows: string[][]) {
  const normalized = headers.map(normalizeHeader);
  const preferredIndex = normalized.findIndex(
    (header) =>
      (header.includes("sm_rootzone") ||
        header.includes("rootzone") ||
        header.includes("root_zone")) &&
      !header.includes("pctl") &&
      !header.includes("wetness") &&
      !header.includes("surface"),
  );

  if (preferredIndex >= 0) {
    return preferredIndex;
  }

  const ignored = new Set([
    "id",
    "category",
    "latitude",
    "longitude",
    "lat",
    "lon",
    "x",
    "y",
    "time",
    "date",
    "qa",
  ]);

  const numericCandidates = normalized
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => !ignored.has(header))
    .filter(({ index }) =>
      rows.some((row) => {
        const value = row[index]?.trim();
        return value ? Number.isFinite(Number(value)) : false;
      }),
    );

  if (numericCandidates.length === 1) {
    return numericCandidates[0]!.index;
  }

  return -1;
}

export function parseAppEearsPointCsv(
  raw: string,
  startDate: string,
  endDate: string,
): SmapObservation[] {
  const rows = parseCsvRows(raw);
  if (rows.length <= 1) {
    return [];
  }

  const [headers, ...dataRows] = rows;
  const dateIndex = selectDateColumnIndex(headers);
  const valueIndex = selectValueColumnIndex(headers, dataRows);

  if (dateIndex < 0) {
    throw new Error(
      "[smap-validation] AppEEARS CSV is missing a recognizable date column.",
    );
  }

  if (valueIndex < 0) {
    throw new Error(
      "[smap-validation] AppEEARS CSV is missing a recognizable SMAP root-zone column.",
    );
  }

  const valuesByDate = new Map<string, number[]>();

  for (const row of dataRows) {
    const date = normalizeObservationDate(row[dateIndex] ?? "");
    if (!date || date < startDate || date > endDate) {
      continue;
    }

    const value = Number(row[valueIndex] ?? "");
    const rootZonePct = normalizeRootZonePercent(value);
    if (rootZonePct === null) {
      continue;
    }

    const existing = valuesByDate.get(date) ?? [];
    existing.push(rootZonePct);
    valuesByDate.set(date, existing);
  }

  return [...valuesByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({
      date,
      rootZonePct: values.reduce((sum, value) => sum + value, 0) / values.length,
    }));
}

async function authenticateAppEears(
  fetchImpl: typeof fetch,
  input: {
    username: string;
    password: string;
    baseUrl: string;
    requestTimeoutMs: number;
  },
) {
  const payload = await fetchJson<AppEearsLoginResponse>(
    fetchImpl,
    `${input.baseUrl}/login`,
    {
      method: "POST",
      headers: {
        authorization: buildBasicAuthHeader(input.username, input.password),
      },
    },
    {
      timeoutMs: input.requestTimeoutMs,
      action: "AppEEARS login",
    },
  );

  if (!payload.token) {
    throw new Error("[smap-validation] AppEEARS login response missing token.");
  }

  return payload.token;
}

async function submitAppEearsPointTask(
  fetchImpl: typeof fetch,
  input: {
    token: string;
    baseUrl: string;
    requestTimeoutMs: number;
    payload: AppEearsPointTaskRequest;
  },
) {
  const response = await fetchJson<AppEearsTaskResponse>(
    fetchImpl,
    `${input.baseUrl}/task`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input.payload),
    },
    {
      timeoutMs: input.requestTimeoutMs,
      action: "AppEEARS task submit",
    },
  );

  if (!response.task_id) {
    throw new Error(
      "[smap-validation] AppEEARS task submit response missing task_id.",
    );
  }

  return response.task_id;
}

async function pollAppEearsTaskUntilDone(
  fetchImpl: typeof fetch,
  input: {
    token: string;
    baseUrl: string;
    requestTimeoutMs: number;
    pollIntervalMs: number;
    taskTimeoutMs: number;
    taskId: string;
  },
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= input.taskTimeoutMs) {
    const record = await fetchJson<AppEearsTaskRecord>(
      fetchImpl,
      `${input.baseUrl}/task/${input.taskId}`,
      {
        headers: {
          authorization: `Bearer ${input.token}`,
        },
      },
      {
        timeoutMs: input.requestTimeoutMs,
        action: `AppEEARS task lookup (${input.taskId})`,
      },
    );

    const status = record.status?.toLowerCase();
    if (status === "done") {
      return record;
    }

    if (status === "error" || status === "failed") {
      const errorMessage = parseErrorMessage(record.error) ?? "task failed";
      throw new Error(
        `[smap-validation] AppEEARS task ${input.taskId} failed: ${errorMessage}`,
      );
    }

    await sleep(input.pollIntervalMs);
  }

  throw new Error(
    `[smap-validation] AppEEARS task ${input.taskId} did not complete within ${input.taskTimeoutMs}ms.`,
  );
}

async function listAppEearsBundleFiles(
  fetchImpl: typeof fetch,
  input: {
    token: string;
    baseUrl: string;
    requestTimeoutMs: number;
    taskId: string;
  },
) {
  const bundle = await fetchJson<AppEearsBundleResponse>(
    fetchImpl,
    `${input.baseUrl}/bundle/${input.taskId}`,
    {
      headers: {
        authorization: `Bearer ${input.token}`,
      },
    },
    {
      timeoutMs: input.requestTimeoutMs,
      action: `AppEEARS bundle lookup (${input.taskId})`,
    },
  );

  return bundle.files ?? [];
}

function selectAppEearsResultFile(
  files: AppEearsBundleResponse["files"],
): {
  file_id: string;
  file_name?: string;
  file_type?: string;
} {
  const resultFile =
    files?.find(
      (file) =>
        file.file_type?.toLowerCase() === "csv" &&
        file.file_name?.toLowerCase().includes("results"),
    ) ??
    files?.find((file) => file.file_type?.toLowerCase() === "csv") ??
    null;

  if (!resultFile?.file_id) {
    throw new Error(
      "[smap-validation] AppEEARS bundle did not include a CSV results file.",
    );
  }

  return {
    ...resultFile,
    file_id: resultFile.file_id,
  };
}

async function downloadAppEearsResultFile(
  fetchImpl: typeof fetch,
  input: {
    token: string;
    baseUrl: string;
    requestTimeoutMs: number;
    taskId: string;
    fileId: string;
  },
) {
  const response = await fetchWithRetry(
    fetchImpl,
    `${input.baseUrl}/bundle/${input.taskId}/${input.fileId}`,
    {
      headers: {
        authorization: `Bearer ${input.token}`,
      },
      redirect: "follow",
    },
    {
      timeoutMs: input.requestTimeoutMs,
    },
  );

  if (!response.ok) {
    const body = await readResponseText(response);
    throw new Error(
      `[smap-validation] AppEEARS bundle download failed with ${response.status}${
        body.trim() ? `: ${body.trim().slice(0, 240)}` : ""
      }`,
    );
  }

  return response.text();
}

// ---------------------------------------------------------------------------
// CSV fixture loader
// ---------------------------------------------------------------------------

/**
 * CSV fixture format (one row per day):
 *
 *   date,root_zone_sm_pct
 *   2024-01-01,32.4
 *   2024-01-02,31.8
 *   ...
 *
 * The fixture file is keyed by field ID; pass the path when creating.
 */
export function createCsvFixtureSmapSource(csvPath: string): SmapDataSource {
  return {
    async fetchSmapTimeseries(
      _lat: number,
      _lng: number,
      startDate: string,
      endDate: string,
    ): Promise<SmapObservation[]> {
      const { readFile } = await import("node:fs/promises");

      const raw = await readFile(csvPath, "utf-8");
      const lines = raw.trim().split("\n");

      // Skip header
      const observations: SmapObservation[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [date, valueStr] = line.split(",");
        if (!date || !valueStr) continue;

        const rootZonePct = parseFloat(valueStr);
        if (!Number.isFinite(rootZonePct)) continue;

        // Filter to requested date range
        if (date >= startDate && date <= endDate) {
          observations.push({ date, rootZonePct });
        }
      }

      return observations;
    },
  };
}

// ---------------------------------------------------------------------------
// AppEEARS integration
// ---------------------------------------------------------------------------
export function createAppEearsSmapSource(
  username: string,
  password: string,
  baseUrlOrOptions?: string | CreateAppEearsSmapSourceOptions,
  maybeOptions?: CreateAppEearsSmapSourceOptions,
): SmapDataSource {
  const options: CreateAppEearsSmapSourceOptions =
    typeof baseUrlOrOptions === "string"
      ? {
          ...maybeOptions,
          baseUrl: baseUrlOrOptions,
        }
      : (baseUrlOrOptions ?? {});

  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const taskTimeoutMs = options.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
  let accessTokenPromise: Promise<string> | null = null;

  function getAccessToken() {
    accessTokenPromise ??= authenticateAppEears(fetchImpl, {
      username,
      password,
      baseUrl,
      requestTimeoutMs,
    });

    return accessTokenPromise;
  }

  return {
    async fetchSmapTimeseries(
      lat: number,
      lng: number,
      startDate: string,
      endDate: string,
    ): Promise<SmapObservation[]> {
      const token = await getAccessToken();
      const taskPayload = buildAppEearsPointTaskRequest({
        lat,
        lng,
        startDate,
        endDate,
        productAndVersion: options.productAndVersion,
        layer: options.layer,
      });

      const taskId = await submitAppEearsPointTask(fetchImpl, {
        token,
        baseUrl,
        requestTimeoutMs,
        payload: taskPayload,
      });

      await pollAppEearsTaskUntilDone(fetchImpl, {
        token,
        baseUrl,
        requestTimeoutMs,
        pollIntervalMs,
        taskTimeoutMs,
        taskId,
      });

      const files = await listAppEearsBundleFiles(fetchImpl, {
        token,
        baseUrl,
        requestTimeoutMs,
        taskId,
      });
      const resultFile = selectAppEearsResultFile(files);
      const csv = await downloadAppEearsResultFile(fetchImpl, {
        token,
        baseUrl,
        requestTimeoutMs,
        taskId,
        fileId: resultFile.file_id,
      });

      return parseAppEearsPointCsv(csv, startDate, endDate);
    },
  };
}
