import type { GrainPriceSnapshot } from "../contracts/GrainPriceSnapshot";

export type MarketPriceFeed = {
  latest(cropSymbol: string): Promise<GrainPriceSnapshot | null>;
};
