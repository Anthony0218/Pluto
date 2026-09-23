import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { GAME_MODE_LABELS } from "../../games/MedievalKingdoms/gameModes";

import {
  isBattleCompleted,
  isBattleUnlocked,
} from "../../games/MedievalKingdoms/campaignProgress";

import type {
  CampaignDefinition,
  CampaignProgress,
} from "../../games/MedievalKingdoms/types";

export default function RegionMap({
  campaign,
  progress,
}: {
  campaign: CampaignDefinition;
  progress: CampaignProgress;
}) {
  const navigate = useNavigate();

  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1500px] text-[#f5e4c1]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d3a448]">
            Campaign Region
          </p>

          <h1 className="mt-1 text-3xl font-black text-[#ffe7ad]">
            {campaign.name}
          </h1>

          <p className="mt-1 text-sm font-bold text-[#c3aa80]">
            {campaign.subtitle}
          </p>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#aa9471]">
            {campaign.description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/games/medieval-kingdoms")}
          className="rounded-xl border border-[#856239] bg-[#4a3521] px-5 py-3 font-bold text-[#f1d9aa] hover:bg-[#604526]"
        >
          ← Continent
        </button>
      </div>

      <div className="relative min-h-[620px] overflow-hidden rounded-2xl border-2 border-[#755433] bg-[#3a291b] shadow-2xl">
        {!imageFailed && campaign.regionMap ? (
          <img
            src={campaign.regionMap}
            alt={`${campaign.name} regional campaign map`}
            draggable={false}
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#705736_0%,_#4b3825_45%,_#281c13_100%)]">
            <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(30deg,#d2b477_1px,transparent_1px),linear-gradient(150deg,#d2b477_1px,transparent_1px)] [background-size:46px_46px]" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#24170c]/20 via-transparent to-[#24170c]/45" />

        {campaign.battles.map((node) => {
          const unlocked = isBattleUnlocked(campaign.id, node, progress);

          const completed = isBattleCompleted(campaign.id, node.id, progress);

          return (
            <button
              key={node.id}
              type="button"
              disabled={!unlocked}
              onClick={() =>
                navigate(
                  `/games/medieval-kingdoms/campaign/${campaign.id}/battle/${node.id}`,
                )
              }
              style={{
                left: `${node.position.x}%`,
                top: `${node.position.y}%`,
              }}
              className={`
                  group
                  absolute
                  z-20
                  w-[170px]
                  -translate-x-1/2
                  -translate-y-1/2
                  rounded-2xl
                  border-2
                  p-3
                  text-left
                  shadow-2xl
                  transition
                  ${
                    completed
                      ? "border-emerald-300 bg-emerald-950/90 text-emerald-50"
                      : unlocked
                        ? "border-[#e1b860] bg-[#4b341d]/95 text-[#f8e3b5] hover:-translate-y-[55%] hover:scale-105 hover:bg-[#604526]"
                        : "cursor-not-allowed border-stone-600 bg-stone-900/85 text-stone-400 opacity-75"
                  }
                `}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-lg">
                  {completed ? "✓" : unlocked ? "⚔" : "🔒"}
                </span>

                <span className="rounded-full border border-current/30 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide">
                  {GAME_MODE_LABELS[node.gameMode]}
                </span>
              </div>

              <div className="mt-2 text-sm font-black">{node.name}</div>

              <div className="mt-1 text-[10px] leading-4 opacity-75">
                {node.description}
              </div>

              {node.optional && (
                <div className="mt-2 text-[8px] font-black uppercase tracking-[0.16em] text-[#e1bd70]">
                  Optional Battle
                </div>
              )}
            </button>
          );
        })}

        <div className="absolute bottom-4 left-4 z-30 rounded-xl border border-[#80613b] bg-[#2f2116]/92 px-4 py-3 text-[10px] leading-5 text-[#c7ad83] backdrop-blur-sm">
          Battles unlock from left to right.
          <br />
          Complete all required battles to unlock the next campaign.
        </div>
      </div>
    </div>
  );
}
