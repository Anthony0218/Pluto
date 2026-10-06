import { useRef } from "react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { useUiLanguage } from "@/i18n/ui";
import LandingHero from "../../components/App/LandingHero";
import ClosingCta from "../../components/App/landing/ClosingCta";
import LandingJourney from "../../components/App/landing/LandingJourney";
import LandingSections from "../../components/App/landing/LandingSections";
import LandingStage from "../../components/App/landing/LandingStage";
import { usePlanetLight } from "../../components/App/landing/usePlanetLight";

/**
 * The landing page: a hero with Games / Tools / Learn tabs, a scroll-driven flyby that follows the selected tab,
 * then one section per game (each with a playable demo), tools, learning and community, and a closing invitation.
 */
export default function LandingPage() {
  useUiLanguage();
  const page = useRef<HTMLElement>(null);
  usePlanetLight(page);
  return <MotionConfig reducedMotion="user"><LazyMotion features={domAnimation} strict>
    <main ref={page}>
      <LandingStage>
        <LandingHero />
        <LandingJourney>
          <LandingSections />
          <ClosingCta />
        </LandingJourney>
      </LandingStage>
    </main>
  </LazyMotion></MotionConfig>;
}
