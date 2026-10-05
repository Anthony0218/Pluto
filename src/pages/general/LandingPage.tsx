import { ui, useUiLanguage } from "@/i18n/ui";
import LandingHero from "../../components/App/LandingHero";
import FeatureSection from "../../components/App/FeatureSection";

import PlayShowcase from "../../components/App/PlayShowcase";
import LearnShowcase from "../../components/App/LearnShowcase";
import CoachShowcase from "../../components/App/CoachShowcase";
import CommunityShowcase from "../../components/App/CommunityShowcase";

export default function LandingPage() {
  useUiLanguage();
  return (
    <MotionConfig reducedMotion="user"><LazyMotion features={domAnimation} strict><main>
      <LandingHero />

      <FeatureSection
        index="01"
        eyebrow={ui("PLAY")}
        title={
          <>{ui("Play")} {" "}<span className="text-indigo-400">{ui("great games.")}</span>
          </>
        }
        description={ui("Chess, Watten, strategy games, variants and multiplayer — all in one place.")}
        href="/games"
        action={ui("Explore games")}
      >
        <PlayShowcase />
      </FeatureSection>

      <FeatureSection
        index="02"
        eyebrow={ui("LEARN")}
        title={
          <>{ui("Learn and")} {" "}<span className="text-indigo-400">{ui("grow stronger.")}</span>
          </>
        }
        description={ui("Rules and strategies that help you understand the games you play.")}
        href="/learn"
        action={ui("Start learning")}
      >
        <LearnShowcase bare />
      </FeatureSection>

      <FeatureSection
        index="03"
        eyebrow={ui("CHESS COACH")}
        title={
          <>{ui("Analyze.")}<br />{ui("Understand.")}<br />
            <span className="text-indigo-400">{ui("Improve.")}</span>
          </>
        }
        description={ui("Analyze games with Stockfish and turn engine evaluations into explanations you can actually learn from.")}
        href="/games/chess/classic/ai"
        action={ui("Practice with Stockfish")}
      >
        <CoachShowcase />
      </FeatureSection>

      <FeatureSection
        index="04"
        eyebrow={ui("COMMUNITY")}
        title={
          <>{ui("Play together.")}<br />{ui("Learn")} {" "}<span className="text-indigo-400">{ui("together.")}</span>
          </>
        }
        description={ui("Challenge friends, complete daily goals and share the experience with other players.")}
        href="/friends"
        action={ui("Explore community")}
      >
        <CommunityShowcase />
      </FeatureSection>
    </main></LazyMotion></MotionConfig>
  );
}
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
