import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useEffect, useRef, useState } from "react";

import { Link, useNavigate } from "react-router-dom";
import { Crown, Flag, Swords } from "lucide-react";

import {
  CONTINENT_MAP,
  WORLD_PLACES,
  findWorldPlaceByColor,
  findWorldPathByColor,
} from "../../games/MedievalKingdoms/worldData";

import {
  isCampaignCompleted,
  isCampaignUnlocked,
  useCampaignProgress,
} from "../../games/MedievalKingdoms/campaignProgress";

import type { WorldPlace } from "../../games/MedievalKingdoms/types";
import type { WorldPathRegion } from "../../games/MedievalKingdoms/worldData";

import ContinentHoverArrow from "./ContinentHoverArrow";

type WorldMaskHit = {
  place: WorldPlace | null;

  path: ReturnType<typeof findWorldPathByColor>;
};

export default function ContinentMap() {
  useGameLanguage();
  const navigate = useNavigate();

  const { progress } = useCampaignProgress();

  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [maskReady, setMaskReady] = useState(false);

  const [hoveredPlace, setHoveredPlace] = useState<WorldPlace | null>(null);

  const [hoveredPath, setHoveredPath] = useState<WorldPathRegion | null>(null);

  const [selectedCampaign, setSelectedCampaign] = useState("brickstone-fortress");
  const borderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  function drawHoveredRegionBorder(maskColor: [number, number, number] | null) {
    const maskCanvas = maskCanvasRef.current;
    const borderCanvas = borderCanvasRef.current;

    if (!maskCanvas || !borderCanvas) return;

    const width = maskCanvas.width;
    const height = maskCanvas.height;

    borderCanvas.width = width;
    borderCanvas.height = height;

    const maskContext = maskCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    const borderContext = borderCanvas.getContext("2d");

    if (!maskContext || !borderContext) return;

    borderContext.clearRect(0, 0, width, height);

    if (!maskColor) return;

    const imageData = maskContext.getImageData(0, 0, width, height);
    const output = borderContext.createImageData(width, height);

    const source = imageData.data;
    const target = output.data;
    const [targetR, targetG, targetB] = maskColor;

    const tolerance = 10;
    const borderThickness = 2;

    function matches(x: number, y: number) {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;

      const index = (y * width + x) * 4;
      const r = source[index];
      const g = source[index + 1];
      const b = source[index + 2];
      const a = source[index + 3];

      if (a < 20) return false;

      return (
        Math.abs(r - targetR) <= tolerance &&
        Math.abs(g - targetG) <= tolerance &&
        Math.abs(b - targetB) <= tolerance
      );
    }

    function isBoundaryPixel(x: number, y: number) {
      if (!matches(x, y)) return false;

      return (
        !matches(x - 1, y) ||
        !matches(x + 1, y) ||
        !matches(x, y - 1) ||
        !matches(x, y + 1)
      );
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!isBoundaryPixel(x, y)) continue;

        for (let dy = -borderThickness; dy <= borderThickness; dy += 1) {
          for (let dx = -borderThickness; dx <= borderThickness; dx += 1) {
            if (dx * dx + dy * dy > borderThickness * borderThickness) continue;

            const px = x + dx;
            const py = y + dy;

            if (px < 0 || py < 0 || px >= width || py >= height) continue;

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
    drawHoveredRegionBorder(hoveredPlace?.maskColor ?? null);
  }, [hoveredPlace]);
  useEffect(() => {
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

    image.src = CONTINENT_MAP.mask;
  }, []);

  function getMaskHitAtEvent(
    event: React.MouseEvent<HTMLDivElement>,
  ): WorldMaskHit | null {
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

    const place = findWorldPlaceByColor(r, g, b);

    const path = findWorldPathByColor(r, g, b);

    return {
      place,
      path,
    };
  }

  const alwaysAvailableCampaigns = new Set([
    "brickstone-fortress",
    "one-eyed-oak",
  ]);

  function isPlaceUnlocked(place: WorldPlace) {
    return (
      alwaysAvailableCampaigns.has(place.campaignId) ||
      isCampaignUnlocked(place.campaignId, progress)
    );
  }

  function openCampaign(place: WorldPlace) {
    if (!isPlaceUnlocked(place)) return;

    navigate(`/games/medieval-kingdoms/campaign/${place.campaignId}`);
  }

  const hoveredUnlocked = hoveredPlace ? isPlaceUnlocked(hoveredPlace) : false;

  const hoveredCompleted = hoveredPlace
    ? isCampaignCompleted(hoveredPlace.campaignId, progress)
    : false;

  return (
    <div className="medieval-world__content text-[#f5e4c1]">
      <div className="medieval-world__heading">
        <span className="medieval-world__crest" aria-hidden="true"><Crown size={28} /></span>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d3a448]">{gameUi(" Medieval Kingdoms ")}</p>

        <h1 className="text-3xl font-black text-[#ffe7ad]">{gameUi("The Kingdoms Await")}</h1>

        <p className="mt-1 text-sm text-[#bda77f]">{gameUi(" Raise your banner. Choose a stronghold. Write your kingdom's story. ")}</p>
      </div>

      <div className="medieval-world__map-stage">
      <div
        onMouseMove={(event) => {
          const hit = getMaskHitAtEvent(event);

          setHoveredPlace(hit?.place ?? null);
          setHoveredPath(hit?.place ? null : (hit?.path ?? null));
        }}
        onMouseLeave={() => {
          setHoveredPlace(null);
          setHoveredPath(null);

        }}
        onClick={(event) => {
          const hit = getMaskHitAtEvent(event);

          if (hit?.place) {
            openCampaign(hit.place);
          }
        }}
        className={`
          medieval-world__map relative
          overflow-hidden
          rounded-2xl
          border-2
          border-[#755433]
          bg-[#3b2a1b]
          shadow-2xl
          ${
            hoveredPlace
              ? hoveredUnlocked
                ? "cursor-pointer"
                : "cursor-not-allowed"
              : hoveredPath
                ? "cursor-help"
                : "cursor-default"
          }
        `}
      >
        <canvas
          ref={borderCanvasRef}
          className=" pointer-events-none
  absolute
  inset-0
  z-30
  h-full
  w-full
  drop-shadow-[0_0_10px_rgba(255,210,80,1)]"
        />
        <img
          src={CONTINENT_MAP.image}
          alt={gameUi("Medieval Kingdoms campaign continent")}
          draggable={false}
          className="block w-full select-none"
        />

        {WORLD_PLACES.map((place) => {
          const unlocked = isPlaceUnlocked(place);

          const completed = isCampaignCompleted(place.campaignId, progress);

          return (
            <button
              type="button"
              key={place.id}
              onClick={(event) => {
                event.stopPropagation();

                openCampaign(place);
              }}
              disabled={!unlocked}
              aria-label={completed ? `${place.name} — campaign complete` : place.name}
              title={
                unlocked
                  ? place.name
                  : `${place.name} — complete the previous campaign first`
              }
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
  uppercase
  tracking-wide
  shadow-lg
  transition
  duration-150

  ${
    completed
      ? "border-emerald-300 bg-emerald-950/90 text-emerald-100"
      : unlocked
        ? "border-[#f1c968] bg-[#62451f]/95 text-[#ffe8aa] opacity-80 hover:opacity-100 hover:scale-110 hover:bg-[#7a5626] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
        : "border-stone-500 bg-stone-900/80 text-stone-300 opacity-0 hover:opacity-100"
  }
`}
              style={{
                left: `${place.marker.x}%`,

                top: `${place.marker.y}%`,
              }}
            >
              {gameUi(completed ? (
                "✓"
              ) : unlocked ? (
                "⚔"
              ) : (
                <span className="text-2xl opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  🔒
                </span>
              ))}
            </button>
          );
        })}

        {gameUi((hoveredPlace || hoveredPath) && (
          <>
            {gameUi(hoveredPlace && hoveredUnlocked && (
              <ContinentHoverArrow marker={hoveredPlace.marker} />
            ))}

            <div className="medieval-world__tooltip pointer-events-none absolute bottom-5 left-1/2 z-50 w-[min(90%,460px)] -translate-x-1/2 rounded-2xl border-2 border-[#b98a45]/80 bg-[#302116]/95 p-4 text-center shadow-2xl backdrop-blur-md">
              <div
                className={`
                  text-[10px]
                  font-black
                  uppercase
                  tracking-[0.22em]
                  ${
                    hoveredPlace
                      ? hoveredCompleted
                        ? "text-emerald-300"
                        : hoveredUnlocked
                          ? "text-[#e7bb61]"
                          : "text-stone-400"
                      : "text-sky-300"
                  }
                `}
              >
                {gameUi(hoveredPlace
                  ? hoveredCompleted
                    ? "Campaign Complete"
                    : hoveredUnlocked
                      ? "Campaign Available"
                      : "Campaign Locked"
                  : hoveredPath?.id === "path"
                    ? "Travel Route"
                    : hoveredPath?.id === "encounter-bridge"
                      ? "Bridge Encounter"
                      : "Encounter Region")}
              </div>

              <div className="mt-1 text-xl font-black text-[#ffe4a3]">
                {gameUi(hoveredPlace?.name ?? hoveredPath?.name)}
              </div>

              <p className="mt-2 text-xs leading-5 text-[#c6ad83]">
                {gameUi(hoveredPlace?.lore ?? hoveredPath?.lore)}
              </p>

              {gameUi(hoveredPlace && (
                <div className="mt-3 text-[10px] uppercase tracking-wider text-[#9e8969]">
                  {gameUi(hoveredUnlocked
                    ? "Click to open regional campaign map"
                    : "Complete the previous campaign to unlock")}
                </div>
              ))}
            </div>
          </>
        ))}
      </div>
      </div>
      <footer className="medieval-world__council">
        <Link to="/games" className="medieval-world__back">{gameUi("← Games")}</Link>
        <div className="medieval-world__progress"><Flag size={16} /><span>{gameUi(WORLD_PLACES.filter((place) => isCampaignCompleted(place.campaignId, progress)).length)} / {gameUi(WORLD_PLACES.length)}{gameUi(" realms conquered")}</span></div>
        <div className="medieval-world__travel">
          <label className="sr-only" htmlFor="campaign-destination">{gameUi("Choose a realm")}</label>
          <select id="campaign-destination" value={selectedCampaign} onChange={(event) => setSelectedCampaign(event.target.value)}>
            {WORLD_PLACES.map((place) => <option key={place.id} value={place.campaignId} disabled={!isPlaceUnlocked(place)}>{place.name}{gameUi(!isPlaceUnlocked(place) ? " · Locked" : "")}</option>)}
          </select>
          <button type="button" onClick={() => { const place = WORLD_PLACES.find((item) => item.campaignId === selectedCampaign); if (place) openCampaign(place); }}><Swords size={16} /><span>{gameUi("Enter realm")}</span></button>
        </div>
      </footer>
    </div>
  );
}
