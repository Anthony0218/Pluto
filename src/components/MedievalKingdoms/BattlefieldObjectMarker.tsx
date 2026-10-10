import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import type {
  BattlefieldObject,
} from "../../games/MedievalKingdoms/types";

const symbols: Record<BattlefieldObject["type"], string> = {
  market: "⚱",
  highGroundPlatform: "▲",
  healingShrine: "✚",
  ballista: "➶",
  capturePoint: "⚑",
  watchtower: "♜",
  blacksmith: "⚒",
  cliffEdge: "⚠",
  supplyCrate: "▣",
  manaShrine: "✦",
  bridgeControl: "⚙",
  barricade: "╬",
  forest: "♣",
  bossAltar: "♛",
  trapTile: "✹",
  teleportRune: "◉",
  jumpPad: "⇧",
  mud: "≈",
  ice: "❄",
  sacredCircle: "✧",
  cursedCircle: "☠",
  riverCurrent: "≋",
  fogArea: "☁",
};

const zoneTypes = new Set<BattlefieldObject["type"]>([
  "cliffEdge",
  "barricade",
  "forest",
  "trapTile",
  "mud",
  "ice",
  "sacredCircle",
  "cursedCircle",
  "riverCurrent",
  "fogArea",
]);

function zoneClasses(
  object: BattlefieldObject,
): string {
  switch (object.type) {
    case "fogArea":
      return "border-slate-200/45 bg-slate-200/20 shadow-[inset_0_0_28px_rgba(255,255,255,0.20),0_0_24px_rgba(226,232,240,0.20)]";
    case "riverCurrent":
      return "border-cyan-300/60 bg-cyan-500/20 shadow-[inset_0_0_24px_rgba(34,211,238,0.28)]";
    case "forest":
      return "border-emerald-700/65 bg-emerald-950/30";
    case "mud":
      return "border-amber-900/70 bg-amber-950/40";
    case "ice":
      return "border-cyan-100/75 bg-cyan-200/20 shadow-[inset_0_0_22px_rgba(207,250,254,0.32)]";
    case "sacredCircle":
      return "border-amber-200/80 bg-amber-200/10 shadow-[0_0_22px_rgba(253,230,138,0.42)]";
    case "cursedCircle":
      return "border-fuchsia-400/75 bg-purple-950/30 shadow-[0_0_22px_rgba(217,70,239,0.38)]";
    case "trapTile":
      return "border-red-500/75 bg-red-950/30 shadow-[0_0_16px_rgba(239,68,68,0.32)]";
    case "barricade":
      return "border-amber-800/80 bg-[#4b2f1d]/50";
    case "cliffEdge":
      return "border-red-800/80 bg-stone-950/40";
    default:
      return "border-[#9a7441]/70 bg-[#473725]/25";
  }
}

function markerClasses(
  object: BattlefieldObject,
  selected: boolean,
  reachable: boolean,
): string {
  if (selected) {
    return "border-[#ffe29a] bg-[#6c4c23]/95 shadow-[0_0_18px_rgba(255,214,112,0.95)]";
  }

  if (
    object.type === "cliffEdge" ||
    object.type === "trapTile" ||
    object.type === "cursedCircle"
  ) {
    return "border-red-700 bg-red-950/80";
  }

  if (reachable) {
    return "border-[#e0ba66] bg-[#5a4024]/90 hover:scale-110";
  }

  return "border-[#7a684d] bg-[#473725]/90 opacity-80 hover:opacity-100";
}

function ZoneDecoration({
  object,
}: {
  object: BattlefieldObject;
}) {
  if (object.type === "fogArea") {
    return (
      <>
        <span className="absolute left-[8%] top-[28%] h-[34%] w-[45%] rounded-full bg-white/18 blur-md animate-pulse" />
        <span className="absolute right-[4%] top-[18%] h-[42%] w-[48%] rounded-full bg-slate-100/20 blur-lg animate-pulse [animation-delay:450ms]" />
        <span className="absolute bottom-[6%] left-[28%] h-[35%] w-[52%] rounded-full bg-white/15 blur-md animate-pulse [animation-delay:850ms]" />
      </>
    );
  }

  if (object.type === "riverCurrent") {
    return (
      <div className="absolute inset-0 flex items-center justify-around overflow-hidden px-[8%] text-cyan-100/70">
        <span className="animate-pulse text-[clamp(10px,1.5vw,24px)]">➜</span>
        <span className="animate-pulse text-[clamp(10px,1.5vw,24px)] [animation-delay:250ms]">➜</span>
        <span className="animate-pulse text-[clamp(10px,1.5vw,24px)] [animation-delay:500ms]">➜</span>
      </div>
    );
  }

  if (object.type === "forest") {
    return (
      <div className="absolute inset-0 flex items-center justify-around text-emerald-200/55">
        <span>♣</span><span>♣</span><span>♣</span>
      </div>
    );
  }

  if (object.type === "ice") {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-cyan-50/75">
        <span className="animate-pulse text-[clamp(12px,2vw,28px)]">❄</span>
      </div>
    );
  }

  if (
    object.type === "sacredCircle" ||
    object.type === "cursedCircle"
  ) {
    return (
      <div className="absolute inset-[12%] rounded-full border border-current/60 animate-pulse" />
    );
  }

  return null;
}

export default function BattlefieldObjectMarker({
  object,
  selected,
  reachable,
  onClick,
}: {
  object: BattlefieldObject;
  selected: boolean;
  reachable: boolean;
  onClick: () => void;
}) {
  useGameLanguage();
  const isZone =
    zoneTypes.has(
      object.type,
    );

  const aspect =
    object.visualAspectRatio ??
    1;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`
        absolute
        z-30
        -translate-x-1/2
        -translate-y-1/2
        transition
        ${isZone ? "rounded-full border-2 border-dashed" : "rounded-full border-2"}
        ${
          isZone
            ? zoneClasses(object)
            : markerClasses(object, selected, reachable)
        }
        ${
          selected
            ? "ring-2 ring-[#ffe29a]/80"
            : ""
        }
      `}
      style={{
        left:
          `${object.position.x}%`,
        top:
          `${object.position.y}%`,
        width:
          `${object.visualSize}%`,
        aspectRatio:
          `${aspect} / 1`,
        transform:
          `translate(-50%, -50%) rotate(${object.rotation ?? 0}deg)`,
      }}
      title={
        gameUi(object.name)
      }
    >
      {gameUi(isZone ? (
        <>
          <ZoneDecoration
            object={
              object
            }
          />

          <span className="relative z-10 text-[clamp(10px,1.25vw,22px)] text-[#f8e7bd]/80 drop-shadow">
            {
              gameUi(symbols[
                object.type
              ])
            }
          </span>
        </>
      ) : (
        <span className="text-[clamp(12px,1.7vw,28px)] text-[#f8e7bd] drop-shadow">
          {
            gameUi(symbols[
              object.type
            ])
          }
        </span>
      ))}

      <span
        className={`
          pointer-events-none
          absolute
          left-1/2
          top-full
          z-20
          mt-1
          -translate-x-1/2
          whitespace-nowrap
          rounded-md
          border
          border-[#6f5332]
          bg-[#352518]/95
          px-2
          py-1
          text-[8px]
          font-black
          uppercase
          tracking-wide
          text-[#efd7a4]
          ${
            isZone
              ? "opacity-75"
              : ""
          }
        `}
        style={{
          transform:
            `translateX(-50%) rotate(${-(object.rotation ?? 0)}deg)`,
        }}
      >
        {
          gameUi(object.name)
        }
      </span>
    </button>
  );
}
