import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRequestedMarketSymbols,
  refreshMarketQuotes,
  SUPPORTED_MARKET_CROP_SYMBOLS,
} from "./marketRefreshQuotes";

test("normalizeRequestedMarketSymbols defaults to all supported crop symbols including rye", () => {
  assert.deepEqual(normalizeRequestedMarketSymbols(undefined), [...SUPPORTED_MARKET_CROP_SYMBOLS]);
  assert.deepEqual(
    normalizeRequestedMarketSymbols([" rye ", "RYE", "canola"]),
    ["RYE", "CANOLA"],
  );
});

test("refreshMarketQuotes parses the latest Johnston's Daily rye bid and normalizes it to CAD per tonne", async () => {
  const calls: string[] = [];
  const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <item>
        <title>March 27th 2026</title>
        <link>https://johnstonsgrain.com/johnstons-daily/march-27th-2026/?utm_source=rss&amp;utm_medium=rss&amp;utm_campaign=march-27th-2026</link>
        <pubDate>Fri, 27 Mar 2026 17:49:54 +0000</pubDate>
      </item>
    </channel>
  </rss>`;
  const ryeHtml = `<html><body><p><strong>RYE</strong><br><br><strong>Hybrid Rye</strong><br>$4.00-$4.50/bu<br>FOB farm February Forward<br><br><strong>Open-Pollinated Rye</strong><br>$4.00-4.50/bu<br>FOB farm February Forward</p></body></html>`;

  const result = await refreshMarketQuotes({
    runtime: {} as never,
    requestedAt: "2026-03-29T00:00:00.000Z",
    cropSymbols: ["rye"],
    dryRun: true,
    async fetchImpl(input) {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);

      if (url === "https://johnstonsgrain.com/feed/") {
        return new Response(feedXml, {
          status: 200,
          headers: { "content-type": "application/rss+xml; charset=UTF-8" },
        });
      }

      if (url === "https://johnstonsgrain.com/johnstons-daily/march-27th-2026/") {
        return new Response(ryeHtml, {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8" },
        });
      }

      return new Response("not found", { status: 404 });
    },
  });

  assert.deepEqual(calls, [
    "https://johnstonsgrain.com/feed/",
    "https://johnstonsgrain.com/johnstons-daily/march-27th-2026/",
  ]);
  assert.equal(result.refreshedCount, 1);
  assert.deepEqual(result.skippedSymbols, []);
  assert.equal(result.quotes[0]?.cropSymbol, "RYE");
  assert.equal(result.quotes[0]?.sourceKey, "johnstonsgrain:western-canada-rye-bids");
  assert.equal(result.quotes[0]?.sourceUrl, "https://johnstonsgrain.com/johnstons-daily/march-27th-2026/");
  assert.equal(result.quotes[0]?.capturedAt, "2026-03-27T17:49:54.000Z");
  assert.equal(result.quotes[0]?.sourceClosePrice, 4.25);
  assert.ok(
    Math.abs((result.quotes[0]?.closePriceCadPerTonne ?? 0) - 167.313575) < 0.000001,
  );
});

test("refreshMarketQuotes parses alternate Johnston's Daily rye markup without relying on a single paragraph shape", async () => {
  const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <item>
        <title>March 28th 2026</title>
        <link>https://johnstonsgrain.com/johnstons-daily/march-28th-2026/</link>
        <pubDate>Sat, 28 Mar 2026 16:10:00 +0000</pubDate>
      </item>
    </channel>
  </rss>`;
  const ryeHtml = `
    <html>
      <body>
        <section>
          <h2>Rye</h2>
          <div>Hybrid Rye FOB farm nearby bid $4.10 to $4.40 / bu</div>
        </section>
      </body>
    </html>`;

  const result = await refreshMarketQuotes({
    runtime: {} as never,
    requestedAt: "2026-03-29T00:00:00.000Z",
    cropSymbols: ["RYE"],
    dryRun: true,
    async fetchImpl(input) {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "https://johnstonsgrain.com/feed/") {
        return new Response(feedXml, { status: 200 });
      }

      if (url === "https://johnstonsgrain.com/johnstons-daily/march-28th-2026/") {
        return new Response(ryeHtml, { status: 200 });
      }

      return new Response("not found", { status: 404 });
    },
  });

  assert.equal(result.refreshedCount, 1);
  assert.equal(result.quotes[0]?.sourceClosePrice, 4.25);
});

test("refreshMarketQuotes records stalled upstream requests as bounded per-symbol failures", async () => {
  const result = await refreshMarketQuotes({
    runtime: {} as never,
    requestedAt: "2026-03-29T00:00:00.000Z",
    cropSymbols: ["RYE"],
    dryRun: true,
    fetchTimeoutMs: 20,
    fetchImpl(_input, init) {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason ?? new Error("aborted"));
        });
      });
    },
  });

  assert.equal(result.refreshedCount, 0);
  assert.equal(result.failedCount, 1);
  assert.equal(result.failures[0]?.cropSymbol, "RYE");
  assert.match(result.failures[0]?.message ?? "", /request timed out after 20ms/i);
});

test("refreshMarketQuotes parses investing rows with whitespace and nested table formatting", async () => {
  const canolaHtml = `
    <table>
      <tbody>
        <tr data-test="historical-data-row">
          <td>
            <time dateTime="Mar 28, 2026">Mar 28, 2026</time>
          </td>
          <td dir="ltr">
            712.40
          </td>
        </tr>
      </tbody>
    </table>`;

  const result = await refreshMarketQuotes({
    runtime: {} as never,
    requestedAt: "2026-03-29T00:00:00.000Z",
    cropSymbols: ["CANOLA"],
    dryRun: true,
    async fetchImpl(input: RequestInfo | URL) {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("canola-futures-historical-data")) {
        return new Response(canolaHtml, { status: 200 });
      }

      return new Response("not found", { status: 404 });
    },
  });

  assert.equal(result.refreshedCount, 1);
  assert.equal(result.quotes[0]?.sourceClosePrice, 712.4);
  assert.equal(result.quotes[0]?.capturedAt, "2026-03-28T00:00:00.000Z");
});

test("refreshMarketQuotes continues refreshing other crops when one upstream source fails", async () => {
  const canolaHtml = `
    <table>
      <tbody>
        <tr>
          <td><time dateTime="Mar 28, 2026">Mar 28, 2026</time></td>
          <td dir="ltr">705.20</td>
        </tr>
      </tbody>
    </table>`;

  const result = await refreshMarketQuotes({
    runtime: {} as never,
    requestedAt: "2026-03-29T00:00:00.000Z",
    cropSymbols: ["CANOLA", "RYE"],
    dryRun: true,
    async fetchImpl(input) {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("canola-futures-historical-data")) {
        return new Response(canolaHtml, { status: 200 });
      }

      if (url === "https://johnstonsgrain.com/feed/") {
        return new Response("source unavailable", { status: 503 });
      }

      return new Response("not found", { status: 404 });
    },
  });

  assert.equal(result.refreshedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.deepEqual(result.skippedSymbols, []);
  assert.equal(result.quotes.length, 1);
  assert.equal(result.quotes[0]?.cropSymbol, "CANOLA");
  assert.equal(result.failures[0]?.cropSymbol, "RYE");
  assert.match(result.failures[0]?.message ?? "", /rye feed request failed with 503/i);
});

test("refreshMarketQuotes continues upserting successful crops when one upsert fails", async () => {
  const canolaHtml = `
    <table>
      <tbody>
        <tr>
          <td><time dateTime="Mar 28, 2026">Mar 28, 2026</time></td>
          <td dir="ltr">705.20</td>
        </tr>
      </tbody>
    </table>`;
  const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <item>
        <title>March 27th 2026</title>
        <link>https://johnstonsgrain.com/johnstons-daily/march-27th-2026/</link>
        <pubDate>Fri, 27 Mar 2026 17:49:54 +0000</pubDate>
      </item>
    </channel>
  </rss>`;
  const ryeHtml = `<html><body><p><strong>RYE</strong><br><strong>Hybrid Rye</strong><br>$4.00-$4.50/bu</p></body></html>`;
  const upsertedSymbols: string[] = [];

  const result = await refreshMarketQuotes({
    runtime: {
      services: {
        market: {
          async upsertPrice(input: any) {
            upsertedSymbols.push(input.cropSymbol);

            if (input.cropSymbol === "RYE") {
              throw new Error("database temporarily unavailable");
            }

            return {
              cropSymbol: input.cropSymbol,
              closePriceCadPerTonne: input.closePriceCadPerTonne,
              basisCadPerTonne: input.basisCadPerTonne,
              sourceCurrency: input.sourceCurrency,
              sourceUnit: input.sourceUnit,
              sourceClosePrice: input.sourceClosePrice,
              fxRateToCad: input.fxRateToCad,
              sourceKey: input.sourceKey,
              capturedAt: input.capturedAt,
              createdAt: "2026-03-29T00:00:00.000Z",
            };
          },
        },
      },
    } as never,
    requestedAt: "2026-03-29T00:00:00.000Z",
    cropSymbols: ["CANOLA", "RYE"],
    dryRun: false,
    async fetchImpl(input) {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("canola-futures-historical-data")) {
        return new Response(canolaHtml, { status: 200 });
      }

      if (url === "https://johnstonsgrain.com/feed/") {
        return new Response(feedXml, { status: 200 });
      }

      if (url === "https://johnstonsgrain.com/johnstons-daily/march-27th-2026/") {
        return new Response(ryeHtml, { status: 200 });
      }

      return new Response("not found", { status: 404 });
    },
  });

  assert.deepEqual(upsertedSymbols, ["CANOLA", "RYE"]);
  assert.equal(result.refreshedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.snapshots.length, 1);
  assert.equal(result.snapshots[0]?.cropSymbol, "CANOLA");
  assert.equal(result.failures[0]?.cropSymbol, "RYE");
  assert.match(result.failures[0]?.message ?? "", /database temporarily unavailable/i);
});
