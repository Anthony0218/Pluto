import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { memo } from "react";
import { chessPieceAssetThemes } from "@/assets/chess/themes";
import { luminance } from "@/games/chess/custom/engine/teams";
import type { VariantPreview } from "@/games/chess/custom/library/preview";
import { getBoardTheme } from "@/games/chess/custom/themes";

const SPECIAL = { "#": "#3f3a36", "*": "#8b5cf6", "+": "#f59e0b" } as const;
const ISO_X = 0.866;
const ISO_Y = 0.5;

function cellFill(char: string, light: boolean, theme: { light: string; dark: string }) {
  if (char === "#") return SPECIAL["#"];
  return light ? theme.light : theme.dark;
}

/**
 * Card-sized picture of a variant: a flat board for single-layer variants,
 * an isometric stack for layered ones. Pieces retain their authored icons and team colours.
 */
function BoardThumbnail({ preview, label, className = "" }: { preview?: VariantPreview; label: string; className?: string }) {
  useGameLanguage();
  if (!preview || !preview.layers.length) {
    return (
      <div role="img" aria-label={gameUi(label)} className={`flex items-center justify-center ${className}`}>
        <div className="grid h-16 w-16 grid-cols-4 overflow-hidden rounded-md opacity-40">
          {Array.from({ length: 16 }, (_, index) => (
            <span key={index} className={(index + Math.floor(index / 4)) % 2 ? "bg-zinc-700" : "bg-zinc-500"} />
          ))}
        </div>
      </div>
    );
  }
  const theme = getBoardTheme(preview.theme);
  return preview.layers.length === 1 ? <FlatBoard preview={preview} theme={theme} label={gameUi(label)} className={className} /> : <StackedBoard preview={preview} theme={theme} label={gameUi(label)} className={className} />;
}

function FlatBoard({ preview, theme, label, className }: { preview: VariantPreview; theme: ReturnType<typeof getBoardTheme>; label: string; className: string }) {
  useGameLanguage();
  const layer = preview.layers[0];
  const { width, height } = layer;
  const pad = 0.35;
  return (
    <svg role="img" aria-label={gameUi(label)} viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`} className={className} preserveAspectRatio="xMidYMid meet">
      <rect x={-pad} y={-pad} width={width + pad * 2} height={height + pad * 2} rx={0.45} fill={theme.frame} />
      {[...layer.cells].map((char, index) => {
        if (char === ".") return null;
        const x = index % width;
        const y = Math.floor(index / width);
        const row = height - 1 - y;
        const light = (x + y) % 2 === 1;
        return (
          <g key={index}>
            <rect x={x} y={row} width={1.01} height={1.01} fill={cellFill(char, light, theme)} />
            {(char === "*" || char === "+") && <circle cx={x + 0.5} cy={row + 0.5} r={0.3} fill="none" stroke={SPECIAL[char]} strokeWidth={0.12} />}
          </g>
        );
      })}
      {preview.pieces
        .filter((piece) => piece.z === 0)
        .map((piece, index) => (
          <PreviewPiece key={index} piece={piece} x={piece.x + 0.5} y={height - 1 - piece.y + 0.5} />
        ))}
    </svg>
  );
}

function StackedBoard({ preview, theme, label, className }: { preview: VariantPreview; theme: ReturnType<typeof getBoardTheme>; label: string; className: string }) {
  useGameLanguage();
  const layers = [...preview.layers].sort((a, b) => a.z - b.z);
  const widest = Math.max(...layers.map((layer) => Math.max(layer.width, layer.height)));
  const gap = widest * 0.42;
  // Project a board point (column, rank-from-back) of a centred layer onto the screen.
  const project = (layer: (typeof layers)[number], index: number, x: number, row: number) => {
    const offsetX = (widest - layer.width) / 2;
    const offsetY = (widest - layer.height) / 2;
    const px = x + offsetX;
    const py = row + offsetY;
    return { x: (px - py) * ISO_X, y: (px + py) * ISO_Y - index * gap };
  };
  const top = -(layers.length - 1) * gap - 1;
  const bottom = widest * 2 * ISO_Y + 1;
  const half = widest * ISO_X + 1;
  return (
    <svg role="img" aria-label={gameUi(label)} viewBox={`${-half} ${top} ${half * 2} ${bottom - top}`} className={className} preserveAspectRatio="xMidYMid meet">
      {layers.map((layer, index) => {
        const corner = (x: number, row: number) => {
          const point = project(layer, index, x, row);
          return `${point.x},${point.y}`;
        };
        return (
          <g key={layer.z} opacity={0.55 + (0.45 * (index + 1)) / layers.length}>
            <polygon points={`${corner(-0.25, -0.25)} ${corner(layer.width + 0.25, -0.25)} ${corner(layer.width + 0.25, layer.height + 0.25)} ${corner(-0.25, layer.height + 0.25)}`} fill={theme.frame} stroke="rgba(56,189,248,.35)" strokeWidth={0.08} />
            {[...layer.cells].map((char, cellIndex) => {
              if (char === ".") return null;
              const x = cellIndex % layer.width;
              const y = Math.floor(cellIndex / layer.width);
              const row = layer.height - 1 - y;
              return <polygon key={cellIndex} points={`${corner(x, row)} ${corner(x + 1, row)} ${corner(x + 1, row + 1)} ${corner(x, row + 1)}`} fill={char === "*" ? SPECIAL["*"] : cellFill(char, (x + y) % 2 === 1, theme)} />;
            })}
            {preview.pieces
              .filter((piece) => piece.z === layer.z)
              .map((piece, pieceIndex) => {
                const center = project(layer, index, piece.x + 0.5, layer.height - 1 - piece.y + 0.5);
                return <PreviewPiece key={pieceIndex} piece={piece} x={center.x} y={center.y - 0.28} />;
              })}
          </g>
        );
      })}
    </svg>
  );
}

const STANDARD_ICONS: Record<string, string> = { pawn: "♟", knight: "♞", bishop: "♝", rook: "♜", queen: "♛", king: "♚" };
const GLYPH_KIND: Record<string, "P" | "N" | "B" | "R" | "Q" | "K"> = { "♙": "P", "♟": "P", "♘": "N", "♞": "N", "♗": "B", "♝": "B", "♖": "R", "♜": "R", "♕": "Q", "♛": "Q", "♔": "K", "♚": "K" };

function PreviewPiece({ piece, x, y }: { piece: VariantPreview["pieces"][number]; x: number; y: number }) {
  useGameLanguage();
  const icon = piece.icon || STANDARD_ICONS[piece.type ?? ""] || (piece.royal ? "♚" : "?");
  const kind = GLYPH_KIND[icon];
  const light = luminance(piece.color) > 0.5;
  const asset = kind ? chessPieceAssetThemes.elegant.pieces[`${light ? "w" : "b"}${kind}`] : undefined;
  return <g>
    {piece.royal && <rect x={x - 0.44} y={y - 0.44} width={0.88} height={0.88} rx={0.12} fill="#fcd34d" fillOpacity={0.14} stroke="#fcd34d" strokeWidth={0.035} />}
    {asset ? <image href={asset} x={x - 0.45} y={y - 0.47} width={0.9} height={0.9} preserveAspectRatio="xMidYMid meet" /> : <text x={x} y={y + 0.03} textAnchor="middle" dominantBaseline="central" fontSize={0.68} fontFamily="'Segoe UI Symbol','Apple Symbols',serif" fill={piece.color} stroke={light ? "#1c1917" : "#d6d3d1"} strokeWidth={0.025} paintOrder="stroke">{gameUi(icon)}</text>}
    <rect x={x - 0.22} y={y + 0.36} width={0.44} height={0.045} rx={0.02} fill={piece.color} />
  </g>;
}

export default memo(BoardThumbnail);
