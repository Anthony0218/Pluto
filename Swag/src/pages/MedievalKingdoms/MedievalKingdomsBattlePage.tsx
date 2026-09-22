import { useCallback } from "react";

import { useNavigate, useParams } from "react-router-dom";

import Battlefield from "../../components/MedievalKingdoms/Battlefield";

import {
  getCampaign,
  getCampaignBattle,
} from "../../games/MedievalKingdoms/campaignData";

import {
  isBattleUnlocked,
  useCampaignProgress,
} from "../../games/MedievalKingdoms/campaignProgress";

import type { FactionId } from "../../games/MedievalKingdoms/types";

export default function MedievalKingdomsBattlePage() {
  const { campaignId, battleNodeId } = useParams<{
    campaignId: string;

    battleNodeId: string;
  }>();

  const navigate = useNavigate();

  const { progress, completeBattle } = useCampaignProgress();

  const campaign = getCampaign(campaignId);

  const battleNode = getCampaignBattle(campaignId, battleNodeId);

  const handleVictory = useCallback(
    (winner: FactionId) => {
      if (!campaign || !battleNode || winner !== "falconstone") {
        return;
      }

      completeBattle(campaign.id, battleNode.id);
    },
    [campaign, battleNode, completeBattle],
  );

  if (!campaign || !battleNode) {
    return (
      <main className="min-h-screen bg-[#21170f] px-4 py-8 text-[#f5e4c1]">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#795a34] bg-[#3b2a1b] p-6">
          <h1 className="text-xl font-black">Battle not found</h1>

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

  if (!isBattleUnlocked(campaign.id, battleNode, progress)) {
    return (
      <main className="min-h-screen bg-[#21170f] px-4 py-8 text-[#f5e4c1]">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#795a34] bg-[#3b2a1b] p-6">
          <div className="text-3xl">🔒</div>

          <h1 className="mt-2 text-xl font-black">Battle locked</h1>

          <p className="mt-2 text-sm text-[#bda77f]">
            Complete the previous regional battle first.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(`/games/medieval-kingdoms/campaign/${campaign.id}`)
            }
            className="mt-4 rounded-xl border border-[#a57c43] bg-[#5a4024] px-4 py-2 font-bold"
          >
            Return to region
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#21170f] px-4 py-8">
      <Battlefield
        battleId={battleNode.battleId}
        gameMode={battleNode.gameMode}
        gameModeConfig={battleNode.gameModeConfig}
        playerFaction="falconstone"
        backPath={`/games/medieval-kingdoms/campaign/${campaign.id}`}
        onVictory={handleVictory}
      />
    </main>
  );
}
