import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import GameXpReward from "@/components/games/GameXpReward";
import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import { useCampaignProgress } from "../../../games/MedievalKingdoms/campaignProgress";

import BlacksmithTimingGame from "./BlacksmithTimingGame";
import DoodleJumpTowerGame from "./DoodleJumpTowerGame";
import ArrowDodgeGame from "./ArrowDodgeGame";
import FishingMinigame from "./FishingMinigame";

type MinigameId = "blacksmith" | "tower" | "arrow-dodge" | "fishing";

const STORAGE_KEY = "medieval-kingdoms-moonville-minigames-v1";

const GAMES: {
  id: MinigameId;
  name: string;
  icon: string;
  description: string;
}[] = [
  {
    id: "blacksmith",
    name: "Blacksmith Timing",
    icon: "⚒",
    description:
      "Strike the glowing center of the forge meter and complete five good hammer blows.",
  },
  {
    id: "tower",
    name: "Doodle Jump Tower",
    icon: "🏰",
    description:
      "Bounce up Moonville's tower platforms and reach the moonlit rooftop.",
  },
  {
    id: "arrow-dodge",
    name: "Arrow Dodge",
    icon: "➶",
    description:
      "Move through the training yard and survive the falling arrow volley.",
  },
  {
    id: "fishing",
    name: "Moonriver Fishing",
    icon: "🎣",
    description: "Time the catch marker and land three Moonriver fish.",
  },
];

function loadCompleted(): MinigameId[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function MoonvilleMinigames() {
  useGameLanguage();
  const navigate = useNavigate();

  const { completeCampaign } = useCampaignProgress();

  const [activeGame, setActiveGame] = useState<MinigameId | null>(null);
  const [lastCompleted, setLastCompleted] = useState<MinigameId | null>(null);

  const [completed, setCompleted] = useState<MinigameId[]>(() =>
    loadCompleted(),
  );

  const allComplete = completed.length === GAMES.length;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    }

    if (completed.length === GAMES.length) {
      completeCampaign("moonville");
    }
  }, [completed, completeCampaign]);

  const activeDefinition = useMemo(
    () => GAMES.find((game) => game.id === activeGame) ?? null,
    [activeGame],
  );

  function finishGame(id: MinigameId) {
    setLastCompleted(id);
    setCompleted((current) =>
      current.includes(id) ? current : [...current, id],
    );

    setActiveGame(null);
  }

  if (activeGame && activeDefinition) {
    return (
      <div className="mx-auto w-full max-w-[1100px] text-[#f5e4c1]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d3a448]">{gameUi(" Moonville Festival ")}</p>

            <h1 className="text-2xl font-black text-[#ffe7ad]">
              {gameUi(activeDefinition.name)}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setActiveGame(null)}
            className="rounded-xl border border-[#80603a] bg-[#4a3521] px-4 py-2 font-black text-[#f5dfb4] hover:bg-[#604526]"
          >{gameUi(" ← Festival ")}</button>
        </div>

        {activeGame === "blacksmith" && (
          <BlacksmithTimingGame onComplete={() => finishGame("blacksmith")} />
        )}

        {activeGame === "tower" && (
          <DoodleJumpTowerGame onComplete={() => finishGame("tower")} />
        )}

        {activeGame === "arrow-dodge" && (
          <ArrowDodgeGame onComplete={() => finishGame("arrow-dodge")} />
        )}

        {activeGame === "fishing" && (
          <FishingMinigame onComplete={() => finishGame("fishing")} />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] text-[#f5e4c1]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d3a448]">{gameUi(" Campaign I ")}</p>

          <h1 className="mt-1 text-4xl font-black text-[#ffe7ad]">{gameUi(" Moonville Festival ")}</h1>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d3a448]">{gameUi(" PLACEHOLDER SINCE THIS MAP IS IN PROGRESS, PLAY THE MINIGAMES FOR NOW. ")}</p>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#bda77f]">{gameUi(" Before joining the wars beyond Moonville, prove yourself in the town's festival games. Complete all four challenges to unlock the next campaign. ")}</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/games/medieval-kingdoms/legacy")}
          className="rounded-xl border border-[#80603a] bg-[#4a3521] px-4 py-3 font-black text-[#f5dfb4] hover:bg-[#604526]"
        >{gameUi(" ← Continent ")}</button>
      </div>

      {lastCompleted && <div className="mb-5"><h2 className="font-bold">{GAMES.find(game => game.id === lastCompleted)?.name} complete</h2><GameXpReward /></div>}
      <div className="mb-5 rounded-2xl border border-[#89683e] bg-[#392719] p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-black text-[#ffe1a0]">{gameUi(" Festival progress ")}</span>

          <span className="text-sm font-black text-[#d6b262]">
            {gameUi(completed.length)}/{gameUi(GAMES.length)}
          </span>
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-full border border-[#74552f] bg-[#21170f]">
          <div
            className="h-full bg-gradient-to-r from-[#9a6b2f] to-[#efc56d] transition-all duration-500"
            style={{
              width: `${(completed.length / GAMES.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {GAMES.map((game) => {
          const done = completed.includes(game.id);

          return (
            <button
              key={game.id}
              type="button"
              onClick={() => setActiveGame(game.id)}
              className={`
                  group
                  rounded-2xl
                  border-2
                  p-5
                  text-left
                  shadow-xl
                  transition
                  ${
                    done
                      ? "border-emerald-500/70 bg-emerald-950/40"
                      : "border-[#89683e] bg-[#3c2a1b] hover:-translate-y-1 hover:border-[#d7aa55] hover:bg-[#4a3420]"
                  }
                `}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="text-4xl">{gameUi(game.icon)}</div>

                <div
                  className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] ${
                    done
                      ? "border-emerald-400 text-emerald-300"
                      : "border-[#87683f] text-[#c9ae80]"
                  }`}
                >
                  {gameUi(done ? "Completed" : "Play")}
                </div>
              </div>

              <div className="mt-4 text-xl font-black text-[#ffe5aa]">
                {gameUi(game.name)}
              </div>

              <p className="mt-2 text-xs leading-5 text-[#bda77f]">
                {gameUi(game.description)}
              </p>
            </button>
          );
        })}
      </div>

      {allComplete && (
        <div className="mt-6 rounded-2xl border-2 border-emerald-500/70 bg-emerald-950/50 p-5 text-center">
          <div className="text-3xl">🏆</div>

          <div className="mt-2 text-xl font-black text-emerald-200">{gameUi(" Moonville Complete ")}</div>

          <p className="mt-2 text-sm text-emerald-100/75">{gameUi(" The next campaign on the continent is now unlocked. ")}</p>

          <button
            type="button"
            onClick={() => navigate("/games/medieval-kingdoms/legacy")}
            className="mt-4 rounded-xl border border-emerald-400 bg-emerald-800 px-5 py-2 font-black text-white hover:bg-emerald-700"
          >{gameUi(" Continue to Continent ")}</button>
        </div>
      )}
    </div>
  );
}
