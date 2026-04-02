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

export default function Home() {
  return (
    <main data-theme="dark" style={{ backgroundColor: "var(--ds-surface-white, #0c120e)" }}>
      <LandingNavbar />
      <Hero />
      <DecisionIntelligence />
      <Features />
      <OneAction />
      <HowItWorks />
      <PrairieCrops />
      <MarketIntelligence />
      <CTASection />
      <Footer />
    </main>
  );
}
