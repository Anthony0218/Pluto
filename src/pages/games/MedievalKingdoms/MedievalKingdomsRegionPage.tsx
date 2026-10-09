import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useNavigate, useParams } from "react-router-dom";

import RegionMap from "../../../components/MedievalKingdoms/RegionMap";
import BrickstoneFortressPage from "./BrickstoneFortressPage";

import { getCampaign } from "../../../games/MedievalKingdoms/campaignData";

import {
  isCampaignUnlocked,
  useCampaignProgress,
} from "../../../games/MedievalKingdoms/campaignProgress";
import MoonvilleMinigames from "@/components/MedievalKingdoms/minigames/MoonvilleMinigames";

export default function MedievalKingdomsRegionPage() {
  useGameLanguage();
  const { campaignId } = useParams<{
    campaignId: string;
  }>();

  const navigate = useNavigate();

  const { progress } = useCampaignProgress();

  const campaign = getCampaign(campaignId);

  if (!campaign) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-8 text-[#f5e4c1]">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#795a34] bg-[#3b2a1b] p-6">
          <h1 className="text-xl font-black">{gameUi("Campaign not found")}</h1>

          <button
            type="button"
            onClick={() => navigate("/games/medieval-kingdoms/legacy")}
            className="mt-4 rounded-xl border border-[#a57c43] bg-[#5a4024] px-4 py-2 font-bold"
          >{gameUi(" Return to continent ")}</button>
        </div>
      </main>
    );
  }

  // The continent map already makes Brickstone available independently of
  // campaign completion. Keep this location preview consistent with that entry.
  if (campaignId === "brickstone-fortress") return <BrickstoneFortressPage />;

  if (!isCampaignUnlocked(campaign.id, progress)) {
    return (
      <main className="min-h-screen bg-[#21170f] px-4 py-8 text-[#f5e4c1]">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-[#795a34] bg-[#3b2a1b] p-6">
            <div className="text-3xl">🔒</div>

            <h1 className="mt-2 text-xl font-black">
              {gameUi(campaign.name)}{gameUi(" is locked ")}</h1>

            <p className="mt-2 text-sm text-[#bda77f]">{gameUi(" This campaign is not available yet. ")}</p>

            <p className="mt-1 text-sm text-[#9f8969]">{gameUi(" Complete the previous campaign first to unlock it. ")}</p>

            <button
              type="button"
              onClick={() => navigate("/games/medieval-kingdoms/legacy")}
              className="mt-4 rounded-xl border border-[#a57c43] bg-[#5a4024] px-4 py-2 font-bold transition hover:bg-[#6a4b29]"
            >{gameUi(" Return to continent ")}</button>
          </div>

          <div className="mt-8 rounded-2xl border border-[#795a34] bg-[#2d2016] p-6">
            <div className="mb-5 text-center">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d3a448]">{gameUi(" While you wait ")}</p>

              <h2 className="mt-1 text-2xl font-black text-[#ffe7ad]">{gameUi(" Minigames ")}</h2>

              <p className="mt-2 text-sm text-[#aa9471]">{gameUi(" Play a few minigames while this campaign is still locked. ")}</p>
            </div>

            <MoonvilleMinigames />
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#21170f] px-4 py-8">
      <RegionMap campaign={campaign} progress={progress} />
    </main>
  );
}
