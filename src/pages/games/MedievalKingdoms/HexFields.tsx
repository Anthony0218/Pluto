import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { memo, useMemo } from "react";
import type { Army, Campaign, District, House } from "../../../games/MedievalKingdoms/edravane/types.ts";
import { BIOMES, center, neighbors, NATIONS } from "../../../games/MedievalKingdoms/edravane/world.ts";
import { supplyConnection } from "../../../games/MedievalKingdoms/edravane/logistics.ts";
import { hasMarriagePact } from "../../../games/MedievalKingdoms/edravane/politics.ts";
import { territoryControl } from "./mapPresentation.ts";
import { visibleMapDistricts } from "./mapViewport.ts";
import { TerrainTile } from "./TerrainTile.tsx";

const points = (d: District, inset = 0) => {
  const [x, y] = center(d);
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180;
    return `${x + (25 - inset) * Math.cos(a)},${y + (25 - inset) * Math.sin(a)}`;
  }).join(" ");
};

type Props = {
  view: Campaign; house: House; overlay: string; regional: boolean; detailed: boolean;
  mini: boolean; viewport: string; supplyArmy?: Army; onSelect: (district: District) => void;
};

/** Camera motion reuses this layer until the visible hex window or game state changes. */
export const HexFields = memo(function HexFields({ view, house, overlay, regional, detailed, mini, viewport, supplyArmy, onSelect }: Props) {
  useGameLanguage();
  const fields = useMemo(() => mini ? view.districts.filter((d) => d.nation || d.biome === "legacy") : visibleMapDistricts(view.districts, viewport), [view.districts, mini, viewport]);
  const visibleIds = useMemo(() => new Set(fields.map((d) => d.id)), [fields]);
  return <g className={mini ? "ed-minimap-fields" : "ed-map-fields"}>
          {fields.map((d) => {
            const owner = view.houses.find((h) => h.id === d.owner),
              owned = owner?.id === house.id;
            const [x, y] = center(d);
            const landControl = territoryControl(view, house, d);
            let fill = BIOMES[d.biome].color;
            if (overlay === "loyalty" && owner)
              fill =
                owner.loyalty < 40
                  ? "#94665e"
                  : owner.loyalty < 65
                    ? "#a99660"
                    : "#6a987e";
            if (overlay === "ownership" && owner) fill = BIOMES[d.biome].color;
            const controlling = view.houses.find((h) => h.id === (d.occupation ?? d.owner));
            if (overlay === "ownership" && owner) fill = regional ? owner.color : NATIONS.find((n) => n.id === controlling?.nation)?.color ?? owner.color;
            if (overlay === "supply" && d.owner) {
              fill = supplyArmy && supplyConnection(view, supplyArmy, d.id).connected ? "#67947c" : "#865e57";
            }
            if (overlay === "diplomacy" && controlling) fill = controlling.nation === house.nation ? "#b8a365" : view.wars.includes([house.nation, controlling.nation].sort().join("|")) ? "#97605b" : hasMarriagePact(view, house, controlling.nation) ? "#628c9b" : "#798577";
            if (overlay === "claims" && controlling) fill = controlling.nation === house.nation ? "#b8a365" : house.family.some((p) => p.alive && (p.claim === controlling.nation || p.claims?.includes(controlling.nation))) ? "#967cac" : "#798577";
            return (
              <g
                key={d.id}
                onClick={mini ? undefined : () => onSelect(d)}
                role={!mini ? "button" : undefined}
                tabIndex={!mini ? 0 : undefined}
                onKeyDown={mini ? undefined : (e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSelect(d); }
                }}
                aria-label={gameUi(`${d.name}, ${owner?.name ?? d.biome}${landControl === "domain" ? ", your direct domain" : landControl === "vassal" ? ", vassal estate" : ""}`)}
                className={!mini ? "ed-hex" : ""}
              >
                <title>
                  {gameUi(d.biome === "sea" ? `${d.name}\nShips only` : [
                    d.settlement === "Hamlet" ? d.name : d.settlement,
                    owner ? `House ${owner.name}` : d.biome === "legacy" ? "Unavailable" : d.biome,
                  ].map((line) => line.length > 36 ? `${line.slice(0, 35)}…` : line).join("\n"))}
                </title>
                <polygon
                  points={points(d)}
                  fill={
                    d.biome === "legacy"
                      ? `url(#${mini ? "mini-legacy" : "legacy-image"})`
                      : fill
                  }
                  stroke="#182e27"
                  strokeWidth={detailed ? ".55" : ".1"}
                  fillOpacity={1}
                />
                {gameUi(overlay === "ownership" && owner && (
                  <polygon
                    points={points(d)}
                    fill={owner.color}
                    opacity=".18"
                    pointerEvents="none"
                  />
                ))}
                {overlay === "terrain" && landControl === "domain" && <polygon points={points(d)} fill="#f1cc70" opacity=".12" pointerEvents="none" />}
                {gameUi(!mini && d.biome !== "legacy" && (regional || NATIONS.some((n) => n.capital === d.id)) && (
                  <g transform={`translate(${x},${y})`}>
                    <TerrainTile d={d} />
                  </g>
                ))}
                {gameUi(d.owner && regional && landControl === "foreign" && (
                  <polygon
                    points={points(d, 1.4)}
                    fill="none"
                    stroke={controlling?.color ?? owner!.color}
                    strokeWidth={1.2}
                  />
                ))}
                {gameUi(d.occupation && (
                  <polygon
                    points={points(d, 2)}
                    fill={`url(#${mini ? "mini-occupation" : "occupation"})`}
                    opacity=".5"
                  />
                ))}
                {gameUi(d.disputed && (
                  <polygon
                    points={points(d, 3)}
                    fill="none"
                    stroke="#ede0c3"
                    strokeWidth="1"
                    strokeDasharray="3 2"
                  />
                ))}
                {gameUi(!mini && (overlay === "resources" || d.biome === "legacy") && (
                  <text
                    x={x}
                    y={y + 5}
                    textAnchor="middle"
                    fontSize={d.biome === "legacy" ? 12 : 10}
                    fill="#132b28"
                    opacity=".8"
                  >
                    {gameUi(d.biome === "legacy"
                      ? "🔒"
                      : overlay === "resources"
                        ? {
                            grain: "♧",
                            timber: "♣",
                            iron: "◆",
                            livestock: "♘",
                            horses: "♞",
                            herbs: "✿",
                            luxury: "✧",
                          }[d.resource]
                        : BIOMES[d.biome].icon)}
                  </text>
                ))}
                {gameUi(detailed && owned && (
                  <text x={x - 10} y={y - 8} fontSize="8" fill="#fff0aa">
                    ♛
                  </text>
                ))}
                {gameUi(!mini && detailed && d.nation && (
                  <>
                    {gameUi(d.port && (
                      <text x={x + 12} y={y + 14} fontSize="8">
                        ⚓
                      </text>
                    ))}
                  </>
                ))}
                {gameUi(detailed && d.bonus && (
                  <circle
                    cx={x - 12}
                    cy={y + 14}
                    r="3.5"
                    fill={d.bonus === "gold" ? "#ffdf6d" : "#e4edf0"}
                    stroke="#49493c"
                  />
                ))}
              </g>
            );
          })}
          {/* Borders follow actual shared hex edges, at estate and nation scales. */}
          {fields
            .filter((d) => d.owner)
            .flatMap((d) => {
              const [x, y] = center(d);
              const nearby = neighbors(view.districts, d.id);
              return Array.from({ length: 6 }, (_, i) => {
                const a = ((60 * i - 30) * Math.PI) / 180,
                  b = ((60 * (i + 1) - 30) * Math.PI) / 180;
                const mx = x + (25 * (Math.cos(a) + Math.cos(b))) / 2,
                  my = y + (25 * (Math.sin(a) + Math.sin(b))) / 2;
                const adjacent = nearby.find(
                  (n) =>
                    n.id !== d.id &&
                    Math.hypot(
                      center(n)[0] - (x + (mx - x) * 2),
                      center(n)[1] - (y + (my - y) * 2),
                    ) < 1,
                );
                if (adjacent?.owner && visibleIds.has(adjacent.id) && adjacent.id < d.id) return null;
                const controller = d.occupation ?? d.owner;
                const neighbor = adjacent?.occupation ?? adjacent?.owner;
                const national =
                    view.houses.find((h) => h.id === neighbor)
                      ?.nation !==
                    view.houses.find((h) => h.id === controller)?.nation,
                  estate = neighbor !== controller;
                const land = territoryControl(view, house, d);
                const other = adjacent ? territoryControl(view, house, adjacent) : "unclaimed";
                const domain = land === "domain" || other === "domain";
                const vassal = land === "vassal" || other === "vassal";
                if (!estate || mini && !national || !national && !regional && !domain && !vassal) return null;
                return (
                  <line
                    key={`${d.id}-${i}`}
                    x1={x + 25 * Math.cos(a)}
                    y1={y + 25 * Math.sin(a)}
                    x2={x + 25 * Math.cos(b)}
                    y2={y + 25 * Math.sin(b)}
                    stroke={domain ? "#f6d97b" : vassal ? "#d5be83" : national ? "#e8d7b0" : "#293932"}
                    strokeWidth={domain ? 2.8 : vassal ? 2.2 : national ? 2.6 : 1.4}
                    strokeDasharray={!domain && vassal ? "1 4" : undefined}
                    strokeLinecap="round"
                    pointerEvents="none"
                    data-control={domain ? "domain" : vassal ? "vassal" : "foreign"}
                  />
                );
              });
            })}
  </g>;
});
