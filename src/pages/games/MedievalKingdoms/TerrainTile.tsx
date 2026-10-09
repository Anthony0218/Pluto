import { memo } from "react";
import type { District } from "../../../games/MedievalKingdoms/edravane/types.ts";

/** All scenery stays inside the playable hex: geography and hit targets share a footprint. */
export const TerrainTile = memo(function TerrainTile({ d }: { d: District }) {
  const forest = d.biome === "forest",
    rock = ["mountains", "glacier", "volcanic", "hills"].includes(d.biome),
    snow = ["glacier", "tundra"].includes(d.biome);
  return (
    <g pointerEvents="none">
      {d.biome === "sea" ? (
        <>
          <path
            d="M-15 -4q4-3 8 0t8 0 M-8 7q4-3 8 0t8 0"
            fill="none"
            stroke="#77bfc6"
            opacity=".35"
            strokeWidth=".7"
          />
        </>
      ) : (
        <>
          <path
            d="M-17 9Q-5 0 9 9M-13 14Q1 5 16 14"
            fill="none"
            stroke={snow ? "#e5f1ec" : "#544d2c"}
            opacity=".22"
            strokeWidth=".7"
          />
          {forest &&
            [-11, 0, 11].map((x, i) => (
              <g key={x} transform={`translate(${x},${i % 2 ? -9 : -3})`}>
                <path
                  d="M0 -9L-5 0h3l-4 5H6L2 0h3Z"
                  fill={d.nation === "sylvarenne" ? "#356f50" : "#294d36"}
                  stroke="#a8b073"
                  strokeWidth=".5"
                />
                <path d="M0 4v4" stroke="#4e3928" />
              </g>
            ))}
          {rock &&
            [-9, 8].map((x, i) => (
              <g key={x} transform={`translate(${x},${i ? 3 : -4})`}>
                <path
                  d="M-10 9L0 -10L11 9Z"
                  fill={
                    d.biome === "volcanic"
                      ? "#392e30"
                      : d.biome === "hills"
                        ? "#748153"
                        : "#727d77"
                  }
                  stroke="#3f4d43"
                  strokeWidth=".6"
                />
                <path
                  d="M0-10L-4-2L0-4L4-1Z"
                  fill={snow || d.biome === "mountains" ? "#edf0d7" : "#a7ad76"}
                />
                {d.biome === "volcanic" && (
                  <path
                    d="M0-9L3 0L1 6"
                    fill="none"
                    stroke="#ff753b"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            ))}
          {["plains", "steppe"].includes(d.biome) &&
            [-10, 0, 10].map((x) => (
              <path
                key={x}
                d={`M${x - 3} -9l2 6m-1-8l2 6m1-5l2 6m-4 3l2 6m0-8l2 6`}
                stroke={d.biome === "plains" ? "#e7cf7f" : "#c9b783"}
                strokeWidth="1"
                opacity=".6"
              />
            ))}
          {d.biome === "river" && (
            <>
              <path
                d={`M${d.r % 2 ? -10.825 : 10.825} -18.75Q-6 -8 0 0T${d.r % 2 ? -10.825 : 10.825} 18.75`}
                fill="none"
                stroke="#dbdba3"
                strokeWidth="6"
              />
              <path
                d={`M${d.r % 2 ? -10.825 : 10.825} -18.75Q-6 -8 0 0T${d.r % 2 ? -10.825 : 10.825} 18.75`}
                fill="none"
                stroke="#458fa1"
                strokeWidth="4"
              />
            </>
          )}
          {d.biome === "desert" && (
            <path
              d="M-18 6Q-7-6 3 5Q12-5 18 4M-13 12Q0 2 14 11"
              fill="none"
              stroke="#e9c687"
              strokeWidth="2"
            />
          )}
          {snow && !rock && (
            <path
              d="M-10-9l5 3m-1-6l-2 7m13 7l6 3m-1-6l-3 7"
              stroke="#eef4e8"
              strokeWidth="1"
            />
          )}
          {d.road && (
            <path
              d="M-20 8Q-6 12 3 4T20-8"
              fill="none"
              stroke="#e7d1a0"
              strokeWidth="1.4"
              strokeDasharray="2 1"
              opacity=".7"
            />
          )}
          {d.farm && ["plains", "river", "steppe", "coast"].includes(d.biome) && <g className="ed-cultivated-fields" opacity={d.harvestedAt === undefined ? ".5" : ".3"}><path d="M-16 10l8-3 6 7-8 3Z" fill={(d.development ?? 0) > 0 ? "#d6b467" : "#b59c5c"} stroke="#675c39" strokeWidth=".5" /><path d="M-14 11l6-2M-12 13l6-2M-10 15l6-2" stroke="#f2da94" strokeWidth=".7" /></g>}
          {(d.development ?? 0) >= 2 && <path d="M10-10v6h5v-6l-2.5-3Z" fill="#eed7ae" stroke="#5b5943" strokeWidth=".5" />}
          {d.city && (
            <g
              transform={`translate(${d.castle ? -9 : 0},5)`}
              aria-label={d.city === "major" ? "Major city" : "City"}
            >
              <path
                d="M-6 5V-2h4V-7h4v3h4V5Z"
                fill="#e7dcc0"
                stroke="#334e45"
                strokeWidth=".7"
              />
              <path
                d="M-7-2l3-4 3 4M-3-7l3-5 3 5M2-4l3-4 3 4"
                fill="#785643"
                stroke="#334e45"
                strokeWidth=".6"
              />
              <path d="M-4 2v3M0-3v2M4 0v3" stroke="#496153" strokeWidth="1" />
              {d.city === "major" && (
                <path
                  d="M-8 6H9M-8 3v3M9 3v3"
                  stroke="#ecd79f"
                  strokeWidth="1.3"
                />
              )}
            </g>
          )}
          {d.castle && (
            <g
              transform={`translate(${d.city ? 9 : 0},4)`}
              aria-label={`Castle level ${d.castle.level}`}
            >
              <path
                d="M-6 6V-5h2v2h2v-2h4v2h2v-2h2V6Z"
                fill="#b9c1b2"
                stroke="#243a34"
                strokeWidth=".9"
              />
              <path d="M-2 6V1a2 2 0 014 0v5" fill="#3c554b" />
              <path
                d="M0-5v-6h5l-2 2 2 2H0"
                fill={d.castle.level === 3 ? "#efc65c" : "#9e4e3e"}
                stroke="#3c554b"
                strokeWidth=".5"
              />
              {d.castle.level === 3 && (
                <path
                  d="M-8 7V0h2M8 7V0H6"
                  fill="none"
                  stroke="#e9cc7f"
                  strokeWidth="1.5"
                />
              )}
            </g>
          )}
          {d.port && <g className="ed-working-port" transform="translate(13,14)"><path d="M-5 0H5M-3-3V4M2-3V4" stroke="#e7c995" strokeWidth="1" /><path d="M-5 4Q0 9 5 4Z" fill="#e4d6b0" stroke="#334e45" strokeWidth=".6" />{d.shipyard && <path d="M0 4V-4L4 2H0" fill="#b87b61" stroke="#334e45" strokeWidth=".5" />}</g>}
          {d.depot && <g transform="translate(-13,-12)"><rect x="-4" y="-2" width="8" height="6" rx="1" fill="#d2b274" stroke="#4a5139" strokeWidth=".7" /><path d="M-5-2L0-6 5-2" stroke="#5b4b33" strokeWidth="1.5" /><path d="M-2 0V3M2 0V3" stroke="#fff0b8" strokeWidth=".7" /></g>}
          {d.watchtower && <path d="M-14-6V-15h4v9M-15-15l3-4 3 4" fill="#d8d9c3" stroke="#42564a" strokeWidth=".6" />}
          {(d.development ?? 0) > 0 && <g className="ed-prosperity-pips" fill="#f1d484">{Array.from({ length: d.development ?? 0 }, (_, i) => <circle key={i} cx={-3 + i * 3} cy="-17" r="1" />)}</g>}
        </>
      )}
    </g>
  );
});

/** A sparse atlas relief keeps the world readable without flattening its geography. */
export const TerrainRelief = memo(function TerrainRelief({ d }: { d: District }) {
  if (["mountains", "hills", "glacier"].includes(d.biome)) return <path d="M-13 6L-5-8 2 6M-1 6L7-5 14 6M-5-8L-7-3-5-5-3-2" fill="none" stroke={d.biome === "glacier" ? "#f3f1d1" : "#465949"} opacity=".38" strokeWidth=".8" />;
  if (d.biome === "forest") return <path d="M-12 4l4-9 4 9M-4 5l4-10 4 10M4 3l4-8 4 8" stroke="#274c37" fill="#315c4033" opacity=".38" strokeWidth=".7" />;
  if (d.farm && ["plains", "steppe"].includes(d.biome)) return <path d="M-13 6L3-1M-11 9L5 2M-9 12L7 5" stroke="#f1d999" opacity=".23" strokeWidth=".7" />;
  if (d.biome === "river") return <path d={`M${d.r % 2 ? -10.825 : 10.825}-18.75Q-6-8 0 0T${d.r % 2 ? -10.825 : 10.825} 18.75`} stroke="#89b9b1" fill="none" strokeWidth="2" opacity=".58" />;
  return null;
});
