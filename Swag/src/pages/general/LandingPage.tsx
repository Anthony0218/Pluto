import LandingHero from "../../components/App/LandingHero";
import FeatureSection from "../../components/App/FeatureSection";

import PlayShowcase from "../../components/App/PlayShowcase";
import LearnShowcase from "../../components/App/LearnShowcase";
import CoachShowcase from "../../components/App/CoachShowcase";
import CommunityShowcase from "../../components/App/CommunityShowcase";

export default function LandingPage() {
  return (
    <main>
      <LandingHero />

      <FeatureSection
        index="01"
        eyebrow="PLAY"
        title={
          <>
            Play <span className="text-indigo-400">great games.</span>
          </>
        }
        description="
          Chess, Watten, strategy games,
          variants and multiplayer —
          all in one place.
        "
        href="/games"
        action="Explore games"
      >
        <PlayShowcase />
      </FeatureSection>

      <FeatureSection
        index="02"
        eyebrow="LEARN"
        title={
          <>
            Learn and <span className="text-indigo-400">grow stronger.</span>
          </>
        }
        description="
          Interactive lessons, rules,
          strategies and courses that
          help you understand the games
          you play.
        "
        href="/learn"
        action="Start learning"
        reverse
      >
        <LearnShowcase />
      </FeatureSection>

      <FeatureSection
        index="03"
        eyebrow="CHESS COACH"
        title={
          <>
            Analyze.
            <br />
            Understand.
            <br />
            <span className="text-indigo-400">Improve.</span>
          </>
        }
        description="
          Analyze games with Stockfish
          and turn engine evaluations
          into explanations you can
          actually learn from.
        "
        href="/coach"
        action="Try Chess Coach"
      >
        <CoachShowcase />
      </FeatureSection>

      <FeatureSection
        index="04"
        eyebrow="COMMUNITY"
        title={
          <>
            Play together.
            <br />
            Learn <span className="text-indigo-400">together.</span>
          </>
        }
        description="
          Challenge friends, complete
          daily goals and share the
          experience with other players.
        "
        href="/friends"
        action="Explore community"
        reverse
      >
        <CommunityShowcase />
      </FeatureSection>
    </main>
  );
}
