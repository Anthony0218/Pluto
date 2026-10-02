import { useEffect, useRef, useState } from "react";
import type {
  Position,
  SkillActionId,
} from "../../games/MedievalKingdoms/types";

export default function SpellEffectOverlay({
  kind,
  start,
  end,
  onDone,
}: {
  kind: SkillActionId;
  start: Position;
  end: Position;
  onDone: () => void;
}) {
  const [t, setT] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const duration = kind === "burn" ? 900 : 650;
    const started = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      setT(progress);
      if (progress < 1) frame = requestAnimationFrame(animate);
      else if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [kind, onDone]);

  const x = start.x + (end.x - start.x) * t;
  const y = start.y + (end.y - start.y) * t;

  if (kind === "teleport")
    return (
      <>
        <Portal position={start} opacity={1 - t * 0.7} />
        <Portal position={end} opacity={0.3 + t * 0.7} />
      </>
    );
  if (kind === "trap")
    return (
      <div
        className="pointer-events-none absolute z-[160] -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${end.x}%`, top: `${end.y}%` }}
      >
        <div className="h-16 w-16 animate-ping rounded-full border-4 border-[#d1a24b]/80" />
      </div>
    );

  const symbol = kind === "burn" ? "🔥" : kind === "heal" ? "✚" : "✦";
  const glow =
    kind === "burn"
      ? "drop-shadow-[0_0_12px_rgba(255,90,0,1)]"
      : kind === "heal"
        ? "drop-shadow-[0_0_12px_rgba(134,239,172,1)]"
        : "drop-shadow-[0_0_12px_rgba(250,204,21,1)]";

  return (
    <>
      <div
        className={`pointer-events-none absolute z-[170] -translate-x-1/2 -translate-y-1/2 text-3xl ${glow}`}
        style={{ left: `${x}%`, top: `${y}%` }}
      >
        {symbol}
      </div>
      {kind === "burn" && (
        <>
          <div
            className="pointer-events-none absolute z-[165] h-5 w-5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-orange-500/60 blur-sm"
            style={{ left: `${x}%`, top: `${y}%` }}
          />
          <div
            className="pointer-events-none absolute z-[164] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-200"
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        </>
      )}
    </>
  );
}

function Portal({
  position,
  opacity,
}: {
  position: Position;
  opacity: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-[170] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${position.x}%`, top: `${position.y}%`, opacity }}
    >
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-dashed border-violet-300 shadow-[0_0_18px_rgba(196,181,253,0.9)]" />
        <div className="absolute inset-4 animate-pulse rounded-full border-2 border-[#e7c77a] bg-violet-500/15" />
      </div>
    </div>
  );
}
