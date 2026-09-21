import { useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  CONTINENT_MAP,
  findWorldPlaceByColor,
} from "../../games/MedievalKingdoms/worldData";

import type { WorldPlace } from "../../games/MedievalKingdoms/types";

import ContinentHoverArrow from "./ContinentHoverArrow";

export default function ContinentMap() {
  const navigate = useNavigate();

  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [maskReady, setMaskReady] = useState(false);

  const [hoveredPlace, setHoveredPlace] = useState<WorldPlace | null>(null);

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

  function getPlaceAtEvent(event: React.MouseEvent<HTMLDivElement>) {
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

    return findWorldPlaceByColor(r, g, b);
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] text-white">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
          Medieval Kingdoms
        </p>

        <h1 className="text-3xl font-black">The Known Realm</h1>

        <p className="mt-1 text-sm text-zinc-400">
          Hover a named location. The golden marker confirms the selected
          region.
        </p>
      </div>

      <div
        onMouseMove={(event) => {
          setHoveredPlace(getPlaceAtEvent(event));
        }}
        onMouseLeave={() => setHoveredPlace(null)}
        onClick={(event) => {
          const place = getPlaceAtEvent(event);

          if (place?.available) {
            navigate(place.route);
          }
        }}
        className={`
          relative
          overflow-hidden
          rounded-2xl
          border
          border-white/10
          bg-white
          shadow-2xl
          ${
            hoveredPlace?.available
              ? "cursor-pointer"
              : hoveredPlace
                ? "cursor-not-allowed"
                : "cursor-default"
          }
        `}
      >
        <img
          src={CONTINENT_MAP.image}
          alt="Medieval Kingdoms continent map"
          draggable={false}
          className="block w-full select-none"
        />

        <img
          src="/MedievalKingdoms/maps/continent-coming-soon-overlay.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />

        {hoveredPlace && (
          <>
            {hoveredPlace.available ? (
              <ContinentHoverArrow marker={hoveredPlace.marker} />
            ) : (
              <div
                className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${hoveredPlace.marker.x}%`,
                  top: `${hoveredPlace.marker.y}%`,
                }}
              >
                <div className="rounded-xl border-2 border-stone-500 bg-stone-800/95 px-3 py-2 text-center text-stone-200 shadow-xl">
                  <div className="text-lg">🔒</div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em]">
                    Coming Soon
                  </div>
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-5 left-1/2 w-[min(90%,420px)] -translate-x-1/2 rounded-2xl border border-amber-300/30 bg-zinc-950/95 p-4 text-center shadow-2xl backdrop-blur-md">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">
                {hoveredPlace.available ? "Region confirmed" : "Region locked"}
              </div>

              <div className="mt-1 text-xl font-black">{hoveredPlace.name}</div>

              <p className="mt-2 text-xs leading-5 text-zinc-400">
                {hoveredPlace.lore}
              </p>

              <div className="mt-2 text-[10px] uppercase tracking-wider text-zinc-500">
                {hoveredPlace.available ? "Click to enter" : "Coming Soon"}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
