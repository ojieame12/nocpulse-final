import { pathToFileURL } from "node:url";
import {
  LIVE_MARKET_FEED_CROP_SYMBOLS,
  type GrainPriceSnapshot,
} from "@fieldpulse/module-market";
import { createServerRuntime, type ServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  parseCliArgs,
  readBooleanFlag,
  readCsvFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";
import { readRequestedAt } from "./runtime/readRequestedAt";

export const SUPPORTED_MARKET_CROP_SYMBOLS = LIVE_MARKET_FEED_CROP_SYMBOLS;

type SupportedMarketCropSymbol = (typeof SUPPORTED_MARKET_CROP_SYMBOLS)[number];

type MarketRefreshInput = {
  runtime: Extract<ServerRuntime, { mode: "supabase" }>;
  requestedAt: string;
  cropSymbols?: readonly string[];
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
};

export type MarketRefreshQuote = {
  cropSymbol: string;
  closePriceCadPerTonne: number;
  basisCadPerTonne: number;
  sourceCurrency: string;
  sourceUnit: string;
  sourceClosePrice: number;
  fxRateToCad: number;
  sourceKey: string;
  capturedAt: string;
  sourceUrl: string;
};

export type MarketRefreshFailure = {
  cropSymbol: string;
  message: string;
};

export type MarketRefreshResult = {
  requestedAt: string;
  dryRun: boolean;
  refreshedCount: number;
  skippedSymbols: readonly string[];
  failedCount: number;
  failures: readonly MarketRefreshFailure[];
  quotes: readonly MarketRefreshQuote[];
  snapshots: readonly GrainPriceSnapshot[];
};

const INVESTING_USER_AGENT =
  "Mozilla/5.0 (compatible; FieldPulseBot/1.0; +https://github.com/ojieame12/nocpulse-final)";
const BANK_OF_CANADA_USD_CAD_URL =
  "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1";
const JOHNSTONS_DAILY_FEED_URL = "https://johnstonsgrain.com/feed/";
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

type MarketSourceConfig = {
  cropSymbol: SupportedMarketCropSymbol;
  url: string;
  sourceCurrency: "CAD" | "USD";
  sourceUnit: "tonne" | "bushel";
  sourceKey: string;
  sourcePriceScale: number;
  bushelsPerTonne: number;
};

const MARKET_SOURCE_CONFIGS: Record<SupportedMarketCropSymbol, MarketSourceConfig> = {
  CANOLA: {
    cropSymbol: "CANOLA",
    url: "https://ca.investing.com/commodities/canola-futures-historical-data",
    sourceCurrency: "CAD",
    sourceUnit: "tonne",
    sourceKey: "investing-canada:ice-canola-futures",
    sourcePriceScale: 1,
    bushelsPerTonne: 1,
  },
  WHEAT: {
    cropSymbol: "WHEAT",
    url: "https://www.investing.com/commodities/us-wheat-historical-data",
    sourceCurrency: "USD",
    sourceUnit: "bushel",
    sourceKey: "investing:cbot-us-wheat-futures",
    sourcePriceScale: 0.01,
    bushelsPerTonne: 36.7437,
  },
  CORN: {
    cropSymbol: "CORN",
    url: "https://www.investing.com/commodities/us-corn-historical-data",
    sourceCurrency: "USD",
    sourceUnit: "bushel",
    sourceKey: "investing:cbot-us-corn-futures",
    sourcePriceScale: 0.01,
    bushelsPerTonne: 39.3679,
  },
  RYE: {
    cropSymbol: "RYE",
    url: JOHNSTONS_DAILY_FEED_URL,
    sourceCurrency: "CAD",
    sourceUnit: "bushel",
    sourceKey: "johnstonsgrain:western-canada-rye-bids",
    sourcePriceScale: 1,
    bushelsPerTonne: 39.3679,
  },
  SOYBEAN: {
    cropSymbol: "SOYBEAN",
    url: "https://www.investing.com/commodities/us-soybeans-historical-data",
    sourceCurrency: "USD",
    sourceUnit: "bushel",
    sourceKey: "investing:cbot-us-soybeans-futures",
    sourcePriceScale: 0.01,
    bushelsPerTonne: 36.7440,
  },
};

function parseDateToUtc(dateText: string) {
  const parsed = Date.parse(`${dateText} UTC`);

  if (!Number.isFinite(parsed)) {
    throw new Error(`[worker-market-refresh] could not parse source date "${dateText}"`);
  }

  return new Date(parsed).toISOString();
}

function parseNumericText(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`[worker-market-refresh] could not parse numeric value "${value}"`);
  }

  return parsed;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#0*38;/gi, "&")
    .replace(/&amp;/gi, "&")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&#8242;/gi, "′")
    .replace(/&nbsp;/gi, " ");
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function htmlToPlainText(value: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      stripHtmlTags(
        value
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/(?:p|div|li|h[1-6]|tr|table|section|article)>/gi, "\n"),
      ),
    ),
  );
}

function parseRfc822DateToUtc(dateText: string) {
  const parsed = Date.parse(dateText);

  if (!Number.isFinite(parsed)) {
    throw new Error(`[worker-market-refresh] could not parse source date "${dateText}"`);
  }

  return new Date(parsed).toISOString();
}

function canonicalizeUrl(value: string) {
  const url = new URL(decodeHtmlEntities(value));
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function fetchMarketResponse(
  fetchImpl: typeof fetch,
  url: string,
  options: {
    acceptLanguage: string;
    timeoutMs: number;
  },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(
      new Error(
        `[worker-market-refresh] request timed out after ${options.timeoutMs}ms for ${url}`,
      ),
    );
  }, options.timeoutMs);

  try {
    return await fetchImpl(url, {
      headers: {
        "user-agent": INVESTING_USER_AGENT,
        "accept-language": options.acceptLanguage,
      },
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : `[worker-market-refresh] request timed out after ${options.timeoutMs}ms for ${url}`;
      throw new Error(message);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractLatestJohnstonsDailyPost(feedXml: string) {
  const itemMatches = feedXml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  for (const item of itemMatches) {
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
    const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

    if (!linkMatch || !pubDateMatch) {
      continue;
    }

    const url = canonicalizeUrl(linkMatch[1]);

    if (!url.includes("/johnstons-daily/")) {
      continue;
    }

    return {
      url,
      publishedAt: parseRfc822DateToUtc(decodeHtmlEntities(pubDateMatch[1]).trim()),
    };
  }

  throw new Error("[worker-market-refresh] could not parse latest Johnston's Daily feed item");
}

function extractLatestInvestingHistoricalRow(html: string, sourceLabel: string) {
  const rowMatches = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];

  for (const row of rowMatches) {
    const dateMatch = row.match(/<time\b[^>]*datetime=["']([^"']+)["']/i);

    if (!dateMatch) {
      continue;
    }

    const priceMatch = row.match(/<td\b[^>]*dir=["']ltr["'][^>]*>\s*([0-9][0-9.,]*)\s*<\/td>/i);

    if (!priceMatch) {
      continue;
    }

    return {
      dateText: dateMatch[1] ?? "",
      closePriceText: priceMatch[1] ?? "",
    };
  }

  throw new Error(`[worker-market-refresh] could not parse ${sourceLabel} source row`);
}

function parseRangeAverage(match: RegExpMatchArray) {
  const low = parseNumericText(match[1] ?? "");
  const high = parseNumericText(match[2] ?? "");
  return (low + high) / 2;
}

function extractJohnstonsRyeSourcePrice(html: string) {
  const ryeText = htmlToPlainText(html);
  const rangePatterns = [
    /Hybrid Rye[^0-9$]{0,80}\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:-|to)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)\s*\/?\s*bu/i,
    /(?:^|\b)RYE\b[^0-9$]{0,120}\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:-|to)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)\s*\/?\s*bu/i,
    /\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:-|to)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)\s*\/?\s*bu/i,
  ];

  for (const pattern of rangePatterns) {
    const match = ryeText.match(pattern);

    if (match) {
      return parseRangeAverage(match);
    }
  }

  const singleValuePatterns = [
    /Hybrid Rye[^0-9$]{0,80}\$?\s*([0-9]+(?:\.[0-9]+)?)\s*\/?\s*bu/i,
    /(?:^|\b)RYE\b[^0-9$]{0,120}\$?\s*([0-9]+(?:\.[0-9]+)?)\s*\/?\s*bu/i,
  ];

  for (const pattern of singleValuePatterns) {
    const match = ryeText.match(pattern);

    if (match?.[1]) {
      return parseNumericText(match[1]);
    }
  }

  throw new Error("[worker-market-refresh] could not parse rye bid");
}

async function fetchCanolaQuote(
  fetchImpl: typeof fetch,
  fetchTimeoutMs: number,
): Promise<MarketRefreshQuote> {
  const response = await fetchMarketResponse(fetchImpl, MARKET_SOURCE_CONFIGS.CANOLA.url, {
    acceptLanguage: "en-CA,en;q=0.9",
    timeoutMs: fetchTimeoutMs,
  });

  if (!response.ok) {
    throw new Error(
      `[worker-market-refresh] canola source request failed with ${response.status}`,
    );
  }

  const html = await response.text();
  const { dateText, closePriceText } = extractLatestInvestingHistoricalRow(html, "canola");

  return {
    cropSymbol: "CANOLA",
    closePriceCadPerTonne: parseNumericText(closePriceText),
    basisCadPerTonne: 0,
    sourceCurrency: "CAD",
    sourceUnit: "tonne",
    sourceClosePrice: parseNumericText(closePriceText),
    fxRateToCad: 1,
    sourceKey: MARKET_SOURCE_CONFIGS.CANOLA.sourceKey,
    capturedAt: parseDateToUtc(dateText),
    sourceUrl: MARKET_SOURCE_CONFIGS.CANOLA.url,
  };
}

async function fetchJohnstonsRyeQuote(
  fetchImpl: typeof fetch,
  fetchTimeoutMs: number,
): Promise<MarketRefreshQuote> {
  const feedResponse = await fetchMarketResponse(fetchImpl, JOHNSTONS_DAILY_FEED_URL, {
    acceptLanguage: "en-CA,en;q=0.9",
    timeoutMs: fetchTimeoutMs,
  });

  if (!feedResponse.ok) {
    throw new Error(
      `[worker-market-refresh] rye feed request failed with ${feedResponse.status}`,
    );
  }

  const latestPost = extractLatestJohnstonsDailyPost(await feedResponse.text());
  const pageResponse = await fetchMarketResponse(fetchImpl, latestPost.url, {
    acceptLanguage: "en-CA,en;q=0.9",
    timeoutMs: fetchTimeoutMs,
  });

  if (!pageResponse.ok) {
    throw new Error(
      `[worker-market-refresh] rye source request failed with ${pageResponse.status}`,
    );
  }

  const sourceClosePrice = extractJohnstonsRyeSourcePrice(await pageResponse.text());
  const config = MARKET_SOURCE_CONFIGS.RYE;

  return {
    cropSymbol: "RYE",
    closePriceCadPerTonne: sourceClosePrice * config.bushelsPerTonne,
    basisCadPerTonne: 0,
    sourceCurrency: "CAD",
    sourceUnit: "bushel",
    sourceClosePrice,
    fxRateToCad: 1,
    sourceKey: config.sourceKey,
    capturedAt: latestPost.publishedAt,
    sourceUrl: latestPost.url,
  };
}

async function fetchUsdCadRate(fetchImpl: typeof fetch, fetchTimeoutMs: number) {
  const response = await fetchMarketResponse(fetchImpl, BANK_OF_CANADA_USD_CAD_URL, {
    acceptLanguage: "en-CA,en;q=0.9",
    timeoutMs: fetchTimeoutMs,
  });

  if (!response.ok) {
    throw new Error(
      `[worker-market-refresh] FX source request failed with ${response.status}`,
    );
  }

  const payload = (await response.json()) as {
    observations?: Array<{
      d?: string;
      FXUSDCAD?: { v?: string };
    }>;
  };
  const latest = payload.observations?.[0];
  const value = latest?.FXUSDCAD?.v;

  if (!latest?.d || typeof value !== "string") {
    throw new Error("[worker-market-refresh] could not parse USD/CAD FX source row");
  }

  return {
    date: latest.d,
    usdCad: parseNumericText(value),
  };
}

async function fetchUsdBushelQuote(
  config: Exclude<MarketSourceConfig, { sourceCurrency: "CAD" }>,
  fetchImpl: typeof fetch,
  fetchTimeoutMs: number,
): Promise<MarketRefreshQuote> {
  const [response, fx] = await Promise.all([
    fetchMarketResponse(fetchImpl, config.url, {
      acceptLanguage: "en-US,en;q=0.9",
      timeoutMs: fetchTimeoutMs,
    }),
    fetchUsdCadRate(fetchImpl, fetchTimeoutMs),
  ]);

  if (!response.ok) {
    throw new Error(
      `[worker-market-refresh] ${config.cropSymbol.toLowerCase()} source request failed with ${response.status}`,
    );
  }

  const html = await response.text();
  const { dateText, closePriceText } = extractLatestInvestingHistoricalRow(
    html,
    config.cropSymbol.toLowerCase(),
  );
  const sourceClosePrice = parseNumericText(closePriceText) * config.sourcePriceScale;
  const closePriceCadPerTonne =
    sourceClosePrice * fx.usdCad * config.bushelsPerTonne;

  return {
    cropSymbol: config.cropSymbol,
    closePriceCadPerTonne,
    basisCadPerTonne: 0,
    sourceCurrency: config.sourceCurrency,
    sourceUnit: config.sourceUnit,
    sourceClosePrice,
    fxRateToCad: fx.usdCad,
    sourceKey: config.sourceKey,
    capturedAt: parseDateToUtc(dateText),
    sourceUrl: config.url,
  };
}

async function fetchSupportedQuote(
  cropSymbol: SupportedMarketCropSymbol,
  fetchImpl: typeof fetch,
  fetchTimeoutMs: number,
) {
  if (cropSymbol === "RYE") {
    return fetchJohnstonsRyeQuote(fetchImpl, fetchTimeoutMs);
  }

  const config = MARKET_SOURCE_CONFIGS[cropSymbol];

  if (config.sourceCurrency === "CAD") {
    return fetchCanolaQuote(fetchImpl, fetchTimeoutMs);
  }

  return fetchUsdBushelQuote(config, fetchImpl, fetchTimeoutMs);
}

export function normalizeRequestedMarketSymbols(
  cropSymbols: readonly string[] | undefined,
): readonly string[] {
  if (!cropSymbols || cropSymbols.length === 0) {
    return [...SUPPORTED_MARKET_CROP_SYMBOLS];
  }

  return [...new Set(cropSymbols.map((entry) => entry.trim().toUpperCase()).filter(Boolean))];
}

export async function refreshMarketQuotes(
  input: MarketRefreshInput,
): Promise<MarketRefreshResult> {
  const requestedSymbols = normalizeRequestedMarketSymbols(input.cropSymbols);
  const skippedSymbols: string[] = [];
  const failures: MarketRefreshFailure[] = [];
  const quotes: MarketRefreshQuote[] = [];
  const fetchTimeoutMs = input.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  for (const cropSymbol of requestedSymbols) {
    if (!(cropSymbol in MARKET_SOURCE_CONFIGS)) {
      skippedSymbols.push(cropSymbol);
      continue;
    }

    try {
      quotes.push(
        await fetchSupportedQuote(
          cropSymbol as SupportedMarketCropSymbol,
          input.fetchImpl ?? fetch,
          fetchTimeoutMs,
        ),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker-market-refresh] failed to fetch ${cropSymbol}: ${message}`);
      failures.push({
        cropSymbol,
        message,
      });
    }
  }

  if (input.dryRun) {
    return {
      requestedAt: input.requestedAt,
      dryRun: true,
      refreshedCount: quotes.length,
      skippedSymbols,
      failedCount: failures.length,
      failures,
      quotes,
      snapshots: [],
    };
  }

  const upsertResults = await Promise.all(
    quotes.map(async (quote) => {
      try {
        return await input.runtime.services.market.upsertPrice({
          cropSymbol: quote.cropSymbol,
          closePriceCadPerTonne: quote.closePriceCadPerTonne,
          basisCadPerTonne: quote.basisCadPerTonne,
          sourceCurrency: quote.sourceCurrency,
          sourceUnit: quote.sourceUnit,
          sourceClosePrice: quote.sourceClosePrice,
          fxRateToCad: quote.fxRateToCad,
          sourceKey: quote.sourceKey,
          capturedAt: quote.capturedAt,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[worker-market-refresh] failed to upsert ${quote.cropSymbol}: ${message}`);
        failures.push({
          cropSymbol: quote.cropSymbol,
          message,
        });
        return null;
      }
    }),
  );
  const snapshots = upsertResults.filter((snapshot): snapshot is GrainPriceSnapshot => snapshot != null);

  return {
    requestedAt: input.requestedAt,
    dryRun: false,
    refreshedCount: snapshots.length,
    skippedSymbols,
    failedCount: failures.length,
    failures,
    quotes,
    snapshots,
  };
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const dryRun = readBooleanFlag(args, "dry-run");
  const cropSymbols = readCsvFlag(args, "crop-symbols");
  const requestedAt = readRequestedAt(
    readStringFlag(args, "requested-at"),
    "worker-market-refresh",
  );

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const result = await refreshMarketQuotes({
    runtime,
    requestedAt,
    cropSymbols,
    dryRun,
  });

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(
    [
      `requestedAt=${result.requestedAt}`,
      `refreshed=${result.refreshedCount}`,
      `dryRun=${result.dryRun ? "yes" : "no"}`,
      `skipped=${result.skippedSymbols.join(",") || "none"}`,
      `failed=${result.failedCount}`,
    ].join(" "),
  );
}

const executedAsScript =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedAsScript) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown market refresh failure";
    console.error(`[worker-market-refresh] ${message}`);
    process.exitCode = 1;
  });
}
