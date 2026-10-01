import { luminance } from "@/games/chess/custom/engine/teams";
import type { PieceDefinition, TeamDefinition } from "@/games/chess/custom/engine/types";

const CHESS_GLYPH = /^[♔-♟]$/u;

/**
 * A piece icon for 2D boards, drawn as SVG so it scales with any square size.
 * Chess glyphs are filled with the team colour; emoji and other icons sit on a team-coloured disc.
 */
export default function PieceToken({ def, team, title }: { def?: PieceDefinition; team?: TeamDefinition; title?: string }) {
  const icon = def?.icon || "?";
  const color = team?.color ?? "#f5efe1";
  const light = luminance(color) > 0.5;
  const outline = light ? "#1c1917" : "#d6d3d1";
  const glyph = CHESS_GLYPH.test(icon);
  const gradientId = `token-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={!title} className="pointer-events-none block h-full w-full select-none overflow-visible">
      {glyph ? (
        <text
          x="50"
          y="54"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="86"
          fontFamily="'Segoe UI Symbol','Noto Sans Symbols 2','DejaVu Sans',serif"
          fill={color}
          stroke={outline}
          strokeWidth={light ? 2.6 : 3.4}
          paintOrder="stroke"
          style={{ filter: "drop-shadow(0 3px 2px rgba(0,0,0,.55))" }}
        >
          {icon}
        </text>
      ) : (
        <>
          <defs>
            <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={light ? 0.9 : 0.35} />
              <stop offset="100%" stopColor={color} />
            </radialGradient>
          </defs>
          <circle cx="50" cy="52" r="40" fill={color} />
          <circle cx="50" cy="52" r="40" fill={`url(#${gradientId})`} stroke={outline} strokeOpacity={0.6} strokeWidth="4" style={{ filter: "drop-shadow(0 3px 3px rgba(0,0,0,.45))" }} />
          <text x="50" y="54" textAnchor="middle" dominantBaseline="central" fontSize="46">
            {icon}
          </text>
        </>
      )}
    </svg>
  );
}
