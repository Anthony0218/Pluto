import { useNavigate, useParams } from "react-router-dom";

import RegionMap from "../../components/MedievalKingdoms/RegionMap";
import MoonvilleMinigames from "../../components/MedievalKingdoms/minigames/MoonvilleMinigames";

import { getCampaign } from "../../games/MedievalKingdoms/campaignData";

import {
  isCampaignUnlocked,
  useCampaignProgress,
} from "../../games/MedievalKingdoms/campaignProgress";

export default function MedievalKingdomsRegionPage() {
  const { campaignId } = useParams<{
    campaignId: string;
  }>();

  const navigate = useNavigate();

  const { progress } = useCampaignProgress();

  const campaign = getCampaign(campaignId);

  if (!campaign) {
    return (
      <main className="min-h-screen bg-[#21170f] px-4 py-8 text-[#f5e4c1]">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#795a34] bg-[#3b2a1b] p-6">
          <h1 className="text-xl font-black">Campaign not found</h1>

          <button
            type="button"
            onClick={() => navigate("/games/medieval-kingdoms")}
            className="mt-4 rounded-xl border border-[#a57c43] bg-[#5a4024] px-4 py-2 font-bold"
          >
            Return to continent
          </button>
        </div>
      </main>
    );
  }

  if (!isCampaignUnlocked(campaign.id, progress)) {
    return (
      <main className="min-h-screen bg-[#21170f] px-4 py-8 text-[#f5e4c1]">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#795a34] bg-[#3b2a1b] p-6">
          <div className="text-3xl">🔒</div>

          <h1 className="mt-2 text-xl font-black">{campaign.name} is locked</h1>

          <p className="mt-2 text-sm text-[#bda77f]">
            Complete the previous campaign first.
          </p>

          <button
            type="button"
            onClick={() => navigate("/games/medieval-kingdoms")}
            className="mt-4 rounded-xl border border-[#a57c43] bg-[#5a4024] px-4 py-2 font-bold"
          >
            Return to continent
          </button>
        </div>
      </main>
    );
  }

  if (campaign.id === "moonville") {
    return (
      <main className="min-h-screen bg-[#21170f] px-4 py-8">
        <MoonvilleMinigames />
      </main>
    );
  }
  if (campaign.id === "brickstone-fortress") {
    return (
      <main className="min-h-screen bg-[#21170f] px-4 py-8">
        <MoonvilleMinigames />
      </main>
    );
  }
  if (campaign.id === "one-eyed-oak") {
    return (
      <main className="min-h-screen bg-[#21170f] px-4 py-8">
        <MoonvilleMinigames />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#21170f] px-4 py-8">
      <RegionMap campaign={campaign} progress={progress} />
    </main>
  );
}
