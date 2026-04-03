import { unstable_noStore as noStore } from "next/cache";
import { getWebServerRuntime } from "../server/runtime/getWebServerRuntime";
import { LandingNavbar } from "../components/landing/landing-navbar";
import { Hero } from "../components/landing/hero";
import { DecisionIntelligence } from "../components/landing/decision-intelligence";
import { Features } from "../components/landing/features";
import { OneAction } from "../components/landing/one-action";
import { HowItWorks } from "../components/landing/how-it-works";
import { PrairieCrops } from "../components/landing/prairie-crops";
import { MarketIntelligence } from "../components/landing/market-intelligence";
import { CTASection } from "../components/landing/cta-section";
import { Footer } from "../components/landing/footer";
import {
  buildLandingMarketIntelligence,
  buildLandingMarketIntelligenceFallback,
} from "../features/home/buildLandingMarketIntelligence";

async function resolveLandingMarketIntelligence() {
  noStore();

  try {
    return await buildLandingMarketIntelligence(getWebServerRuntime());
  } catch {
    return buildLandingMarketIntelligenceFallback();
  }
}

export default async function Home() {
  const marketIntelligence = await resolveLandingMarketIntelligence();

  return (
    <main data-theme="dark" style={{ backgroundColor: "var(--ds-surface-white)" }}>
      <LandingNavbar />
      <Hero />
      <DecisionIntelligence />
      <Features />
      <OneAction />
      <HowItWorks />
      <PrairieCrops />
      <MarketIntelligence {...marketIntelligence} />
      <CTASection />
      <Footer />
    </main>
  );
}
