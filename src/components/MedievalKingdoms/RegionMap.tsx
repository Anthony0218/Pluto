import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { GAME_MODE_LABELS } from "../../games/MedievalKingdoms/gameModes";

import {
  isBattleCompleted,
  isBattleUnlocked,
} from "../../games/MedievalKingdoms/campaignProgress";

import type {
  CampaignBattleNode,
  CampaignDefinition,
  CampaignProgress,
} from "../../games/MedievalKingdoms/types";

function findBattleByColor(
  campaign: CampaignDefinition,
  r: number,
  g: number,
  b: number,
): CampaignBattleNode | null {
  const tolerance = 10;

  return (
    campaign.battles.find((battle) => {
      const [targetR, targetG, targetB] = battle.maskColor;

      return (
        Math.abs(r - targetR) <= tolerance &&
        Math.abs(g - targetG) <= tolerance &&
        Math.abs(b - targetB) <= tolerance
      );
    }) ?? null
  );
}

export default function RegionMap({
  campaign,
  progress,
}: {
  campaign: CampaignDefinition;
  progress: CampaignProgress;
}) {
  useGameLanguage();
  const navigate = useNavigate();

  const [imageFailed, setImageFailed] = useState(false);

  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const borderCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [maskReady, setMaskReady] = useState(false);

  const [hoveredBattle, setHoveredBattle] = useState<CampaignBattleNode | null>(
    null,
  );
  const [debugMask, setDebugMask] = useState<{
    r: number;
    g: number;
    b: number;
    x: number;
    y: number;
    battle: string | null;
  } | null>(null);

  useEffect(() => {
    if (!campaign.regionMask) {
      setMaskReady(false);
      maskCanvasRef.current = null;
      return;
    }

    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!context) {
        return;
      }

      context.drawImage(image, 0, 0);

      maskCanvasRef.current = canvas;
      setMaskReady(true);
    };

    image.src = campaign.regionMask;

    return () => {
      image.onload = null;
    };
  }, [campaign.regionMask]);

  function getBattleAtEvent(
    event: React.MouseEvent<HTMLDivElement>,
  ): CampaignBattleNode | null {
    const canvas = maskCanvasRef.current;

    if (!canvas || !maskReady) {
      return null;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    const x = Math.max(
      0,
      Math.min(
        canvas.width - 1,
        Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width),
      ),
    );

    const y = Math.max(
      0,
      Math.min(
        canvas.height - 1,
        Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height),
      ),
    );

    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      return null;
    }

    const [r, g, b] = context.getImageData(x, y, 1, 1).data;
    const battle = findBattleByColor(campaign, r, g, b);

    setDebugMask({
      r,
      g,
      b,
      x,
      y,
      battle: battle?.name ?? null,
    });

    return battle;

    return findBattleByColor(campaign, r, g, b);
  }

  function drawHoveredBattleBorder(battle: CampaignBattleNode | null) {
    const maskCanvas = maskCanvasRef.current;
    const borderCanvas = borderCanvasRef.current;

    if (!maskCanvas || !borderCanvas) {
      return;
    }

    const width = maskCanvas.width;
    const height = maskCanvas.height;

    borderCanvas.width = width;
    borderCanvas.height = height;

    const maskContext = maskCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    const borderContext = borderCanvas.getContext("2d");

    if (!maskContext || !borderContext) {
      return;
    }

    borderContext.clearRect(0, 0, width, height);

    if (!battle) {
      return;
    }

    const sourceImage = maskContext.getImageData(0, 0, width, height);

    const output = borderContext.createImageData(width, height);

    const source = sourceImage.data;
    const target = output.data;

    const [targetR, targetG, targetB] = battle.maskColor;

    const tolerance = 10;
    const borderThickness = 2;

    function matches(x: number, y: number) {
      if (x < 0 || y < 0 || x >= width || y >= height) {
        return false;
      }

      const index = (y * width + x) * 4;

      const r = source[index];
      const g = source[index + 1];
      const b = source[index + 2];
      const a = source[index + 3];

      if (a < 20) {
        return false;
      }

      return (
        Math.abs(r - targetR) <= tolerance &&
        Math.abs(g - targetG) <= tolerance &&
        Math.abs(b - targetB) <= tolerance
      );
    }

    function isBoundaryPixel(x: number, y: number) {
      if (!matches(x, y)) {
        return false;
      }

      return (
        !matches(x - 1, y) ||
        !matches(x + 1, y) ||
        !matches(x, y - 1) ||
        !matches(x, y + 1)
      );
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!isBoundaryPixel(x, y)) {
          continue;
        }

        for (let dy = -borderThickness; dy <= borderThickness; dy += 1) {
          for (let dx = -borderThickness; dx <= borderThickness; dx += 1) {
            if (dx * dx + dy * dy > borderThickness * borderThickness) {
              continue;
            }

            const px = x + dx;
            const py = y + dy;

            if (px < 0 || py < 0 || px >= width || py >= height) {
              continue;
            }

            const index = (py * width + px) * 4;

            target[index] = 255;
            target[index + 1] = 215;
            target[index + 2] = 80;
            target[index + 3] = 255;
          }
        }
      }
    }

    borderContext.putImageData(output, 0, 0);
  }

  useEffect(() => {
    drawHoveredBattleBorder(hoveredBattle);
  }, [hoveredBattle]);

  function openBattle(battle: CampaignBattleNode) {
    const unlocked = isBattleUnlocked(campaign.id, battle, progress);

    if (!unlocked) {
      return;
    }

    navigate(
      `/games/medieval-kingdoms/campaign/${campaign.id}/battle/${battle.id}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1250px] text-[#f5e4c1]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#d3a448]">{gameUi(" Campaign Region ")}</p>

          <h1 className="mt-1 text-3xl font-black text-[#ffe7ad]">
            {gameUi(campaign.name)}
          </h1>

          <p className="mt-1 text-sm font-bold text-[#c3aa80]">
            {gameUi(campaign.subtitle)}
          </p>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#aa9471]">
            {gameUi(campaign.description)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/games/medieval-kingdoms/legacy")}
          className="rounded-xl border border-[#856239] bg-[#4a3521] px-5 py-3 font-bold text-[#f1d9aa] hover:bg-[#604526]"
        >{gameUi(" ← Continent ")}</button>
      </div>
      {gameUi(debugMask && (
        <div className="fixed left-4 top-4 z-[300] rounded-xl border border-yellow-400 bg-black/90 p-3 font-mono text-xs text-white shadow-2xl">
          <div>{gameUi(" Pixel: ")}{gameUi(debugMask.x)}, {gameUi(debugMask.y)}
          </div>

          <div>{gameUi(" RGB: ")}{gameUi(debugMask.r)}, {gameUi(debugMask.g)}, {gameUi(debugMask.b)}
          </div>

          <div>{gameUi("Battle: ")}{gameUi(debugMask.battle ?? "none")}</div>
        </div>
      ))}

      <div
        onMouseMove={(event) => {
          const battle = getBattleAtEvent(event);

          setHoveredBattle(battle);
        }}
        onMouseLeave={() => {
          setHoveredBattle(null);
          setDebugMask(null);
        }}
        onClick={(event) => {
          const battle = getBattleAtEvent(event);

          if (battle) {
            openBattle(battle);
          }
        }}
        className={`
          relative
          min-h-[620px]
          overflow-hidden
          rounded-2xl
          border-2
          border-[#755433]
          bg-[#3a291b]
          shadow-2xl
          ${
            hoveredBattle &&
            isBattleUnlocked(campaign.id, hoveredBattle, progress)
              ? "cursor-pointer"
              : ""
          }
        `}
      >
        {gameUi(!imageFailed && campaign.regionMap ? (
          <img
            src={campaign.regionMap}
            alt={gameUi(`${campaign.name} regional campaign map`)}
            draggable={false}
            onError={() => setImageFailed(true)}
            className="relative block h-auto w-full select-none"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#705736_0%,_#4b3825_45%,_#281c13_100%)]" />
        ))}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#24170c]/20 via-transparent to-[#24170c]/45" />

        {/* Hovered mask border */}
        <canvas
          ref={borderCanvasRef}
          className="
            pointer-events-none
            absolute
            inset-0
            z-10
            h-full
            w-full
          "
        />

        {/* Existing battle markers */}
        {campaign.battles.map((node) => {
          const unlocked = isBattleUnlocked(campaign.id, node, progress);

          const completed = isBattleCompleted(campaign.id, node.id, progress);

          return (
            <button
              key={node.id}
              type="button"
              disabled={!unlocked}
              onClick={(event) => {
                event.stopPropagation();

                openBattle(node);
              }}
              style={{
                left: `${node.position.x}%`,
                top: `${node.position.y}%`,
              }}
              title={gameUi(node.name)}
              className={`
    group
    absolute
    z-20
    -translate-x-1/2
    -translate-y-1/2
    rounded-full
    border-2
    px-2
    py-1
    text-[10px]
    font-black
    shadow-lg
    transition

    ${
      completed
        ? "border-emerald-300 bg-emerald-950/90 text-emerald-100"
        : unlocked
          ? "border-[#f1c968] bg-[#62451f]/95 text-[#ffe8aa] hover:scale-110 hover:bg-[#7a5626]"
          : "border-transparent bg-transparent text-stone-300 shadow-none"
    }
  `}
            >
              {gameUi(completed ? (
                "✓"
              ) : unlocked ? (
                "⚔"
              ) : (
                <span className="text-xl opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  🔒
                </span>
              ))}
            </button>
          );
        })}
        {gameUi(hoveredBattle && (
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-50 w-[min(90%,460px)] -translate-x-1/2 rounded-2xl border-2 border-[#b98a45]/80 bg-[#302116]/95 p-4 text-center shadow-2xl backdrop-blur-md">
            <div
              className={`
        text-[10px]
        font-black
        uppercase
        tracking-[0.22em]
        ${
          isBattleCompleted(campaign.id, hoveredBattle.id, progress)
            ? "text-emerald-300"
            : isBattleUnlocked(campaign.id, hoveredBattle, progress)
              ? "text-[#e7bb61]"
              : "text-stone-400"
        }
      `}
            >
              {gameUi(isBattleCompleted(campaign.id, hoveredBattle.id, progress)
                ? "Battle Complete"
                : isBattleUnlocked(campaign.id, hoveredBattle, progress)
                  ? "Battle Available"
                  : "Battle Locked")}
            </div>

            <div className="mt-1 text-xl font-black text-[#ffe4a3]">
              {gameUi(hoveredBattle.name)}
            </div>

            <p className="mt-2 text-xs leading-5 text-[#c6ad83]">
              {gameUi(hoveredBattle.description)}
            </p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="rounded-full border border-[#b98a45]/40 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#d8bd8b]">
                {gameUi(GAME_MODE_LABELS[hoveredBattle.gameMode])}
              </span>

              {gameUi(hoveredBattle.optional && (
                <span className="rounded-full border border-[#b98a45]/40 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#e1bd70]">{gameUi(" Optional ")}</span>
              ))}
            </div>

            <div className="mt-3 text-[10px] uppercase tracking-wider text-[#9e8969]">
              {gameUi(isBattleUnlocked(campaign.id, hoveredBattle, progress)
                ? "Click the highlighted region to enter battle"
                : "Complete the previous battle to unlock")}
            </div>
          </div>
        ))}
        <div className="absolute bottom-4 left-4 z-30 rounded-xl border border-[#80613b] bg-[#2f2116]/92 px-4 py-3 text-[10px] leading-5 text-[#c7ad83] backdrop-blur-sm">{gameUi(" Complete all required battles to unlock the next campaign. ")}</div>
      </div>
    </div>
  );
}
