export const LIVE_MARKET_FEED_CROP_SYMBOLS = [
  "CANOLA",
  "WHEAT",
  "CORN",
  "RYE",
  "SOYBEAN",
] as const;

export type LiveMarketFeedCropSymbol = (typeof LIVE_MARKET_FEED_CROP_SYMBOLS)[number];

export function isLiveMarketFeedCropSymbol(
  cropSymbol: string | null | undefined,
): cropSymbol is LiveMarketFeedCropSymbol {
  if (!cropSymbol) {
    return false;
  }

  const normalized = cropSymbol.trim().toUpperCase();
  return (LIVE_MARKET_FEED_CROP_SYMBOLS as readonly string[]).includes(normalized);
}
