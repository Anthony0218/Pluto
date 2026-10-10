import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useId } from "react";

/** Yannick's authored variant: a low viewpoint on the volume behind the board. */
export default function JanmannGambitArtwork({ compact = false }: { compact?: boolean }) {
  useGameLanguage();
  const id = useId().replace(/:/g, "");
  const gold = "#e9b878";
  return (
    <div className={`relative h-full overflow-hidden bg-[#10141e] ${compact ? "min-h-[180px]" : "min-h-[300px]"}`}>
      <svg viewBox="0 0 240 280" role="img" aria-label={gameUi("Janmann’s Gambit by Yannick: a thoughtful man with wavy hair rests his hand on his chin, studying a faceted chess sphere above a table of geometric notes.")} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105">
        <defs>
          <radialGradient id={`${id}-light`} cx="70%" cy="62%" r="65%">
            <stop stopColor="#c88b43" stopOpacity=".3" />
            <stop offset="1" stopColor="#10141e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-skin`} x2="1" y2="1">
            <stop stopColor="#ffe0ac" /><stop offset="1" stopColor="#b77551" />
          </linearGradient>
          <linearGradient id={`${id}-shirt`} x2="1" y2="1">
            <stop stopColor="#a6abb7" /><stop offset="1" stopColor="#484b61" />
          </linearGradient>
          <linearGradient id={`${id}-volume`} x2=".8" y2="1">
            <stop stopColor="#f9d99e" /><stop offset=".5" stopColor="#b77737" /><stop offset="1" stopColor="#453020" />
          </linearGradient>
          <g id={`${id}-pawn`} strokeWidth=".8" strokeLinejoin="round">
            <path d="M-4 0Q-4-3-2-4L-1.4-10H1.4L2-4Q4-3 4 0Z" />
            <circle cy="-12" r="2.8" /><path d="M-3-8H3M-4-1H4" fill="none" />
          </g>
          <g id={`${id}-rook`} strokeWidth=".8" strokeLinejoin="round">
            <path d="M-5 0-4-3-2.5-4-2.5-12-4-13-4-18H-1.5V-15H1.5V-18H4V-13L2.5-12V-4L4-3 5 0Z" />
            <path d="M-3-11H3M-4-2H4" fill="none" />
          </g>
        </defs>

        {/* Dark study and faint construction notes. */}
        <rect width="240" height="280" fill={`url(#${id}-light)`} />
        <path d="M15 40V16H39M201 16H225V40M15 240V264H39M201 264H225V240" fill="none" stroke={gold} opacity=".35" />
        <g fill="none" stroke="#c7cfdd" strokeWidth=".65" opacity=".35" transform="translate(183 64)">
          <circle r="34" /><ellipse rx="16" ry="34" /><ellipse rx="34" ry="12" />
          <path d="M0-34-29 17H29ZM0 34-29-17H29ZM-34 0H34M0-34V34" />
        </g>
        <g fill={gold} fontFamily="Georgia, serif" fontStyle="italic" fontSize="6.5" opacity=".7">
          <text x="145" y="111">{gameUi("8 sectors · 80 Dividends")}</text>
          <text x="154" y="122">{gameUi("V = Vouter − Vinner")}</text>
        </g>

        {/* Seated figure, looking diagonally across the board. */}
        <g strokeLinejoin="round">
          <path d="M7 197 13 153Q18 135 41 124L68 119 90 130Q109 145 118 177L128 200Z" fill={`url(#${id}-shirt)`} stroke="#b8b3af" strokeWidth="1" />
          <path d="M22 181 31 148 53 140M31 193 42 164 64 176M77 140 88 157 89 180" fill="none" stroke="#363b4e" strokeWidth="4" opacity=".6" />
          <path d="M55 107 51 127Q63 146 78 136L87 118Z" fill={`url(#${id}-skin)`} stroke="#754c3b" />
          <path d="M54 59Q78 47 98 66L106 85 105 96 113 104 105 110 102 125Q93 135 81 129L64 117 51 93Z" fill={`url(#${id}-skin)`} stroke="#d69b69" />
          <path d="M99 112 94 125 81 125 71 118 70 108Q85 121 99 112" fill="#755047" opacity=".55" />
          <path d="m91 91 11 3M94 97l6 1M104 111l-8 1" fill="none" stroke="#513c35" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M54 103Q41 103 36 90L29 85 34 74Q24 62 36 53L33 46 47 46Q49 30 64 36 80 21 91 35 110 33 108 48L117 57 108 70 100 79 96 64 84 57 70 62 64 78 56 83Z" fill="#493326" stroke="#d39a60" strokeWidth="1.2" />
          <path d="M36 72Q45 58 63 52T98 47M40 54Q58 37 81 40M43 86Q43 72 57 65M71 48Q90 33 104 46M54 97Q46 89 52 78" fill="none" stroke="#b47e4c" strokeWidth="2" strokeLinecap="round" />
          <path d="M56 85Q47 77 48 89 49 98 56 99" fill={`url(#${id}-skin)`} stroke="#885b42" />
          {/* Raised hand meets the mouth; the forearm rests on the table. */}
          <path d="M54 191Q63 180 75 170L86 139 88 121 96 111Q99 108 101 111L99 121 104 116Q108 115 109 119L106 132 99 143 98 167Q101 183 119 196L108 207 76 203Z" fill={`url(#${id}-skin)`} stroke="#dca777" />
          <path d="m89 140 7-16M99 142l-6 3M75 170l6 16" fill="none" stroke="#9a6547" strokeWidth="1.2" />
        </g>

        {/* Table and an oblique planar net beneath the sphere. */}
        <path d="M0 204 135 177 240 204V242L0 234Z" fill="#755037" />
        <path d="m0 204 135-27 105 27M0 231l240-19" fill="none" stroke={gold} strokeOpacity=".5" />
        <path d="m24 217 85-14 38 22-89 12Z" fill="#d9c5a2" />
        <g fill="none" stroke="#645743" strokeWidth=".8">
          <path d="m44 222 24-12 16 18-40-6 54-10-14 16 32-5-18-11M68 210l30 2" />
          <path d="m39 230 9-2m57 3 13-2" />
        </g>

        {/* Faceted board: visible surfaces and the illuminated volume below. */}
        <g transform="translate(171 182)" stroke={gold} strokeWidth="1" strokeLinejoin="round">
          <ellipse cy="7" rx="62" ry="30" fill="none" strokeDasharray="2 5" opacity=".45" transform="rotate(-20)" />
          <path d="M0-48 37-30 51 7 30 38-10 47-45 22-48-14-23-39Z" fill="#222632" />
          <path d="M0-48-5-17 37-30ZM37-30 25 3 51 7ZM51 7 11 21 30 38ZM30 38-10 47 11 21ZM-10 47-23 14-45 22ZM-45 22-48-14-23 14ZM-48-14-23-39-5-17ZM-23-39 0-48-5-17Z" fill={`url(#${id}-volume)`} />
          <path d="M-5-17 25 3 11 21-23 14Z" fill="#f7cd8b" />
          <path d="M-5-17-23 14-48-14M-23 14 11 21-10 47M11 21 25 3 37-30M25 3-5-17 0-48" fill="none" stroke="#fff0c9" />
          <path d="M-5-17V9L11 21V-5Z" fill="#a9672a" />
          <path d="M-5 9-23 14M-5 9 25 3" fill="none" strokeDasharray="2 2" />
          <g fill="#fae2b3" stroke="#8d603b">
            <use href={`#${id}-rook`} x="-22" y="-29" />
            <use href={`#${id}-pawn`} x="27" y="-17" />
            <use href={`#${id}-pawn`} x="-31" y="12" />
          </g>
          <g fill="#171b23" stroke="#e0b57a">
            <use href={`#${id}-pawn`} x="5" y="-30" />
            <use href={`#${id}-rook`} x="37" y="10" />
            <use href={`#${id}-pawn`} x="7" y="35" />
          </g>
        </g>
        <text x="211" y="237" fill={gold} fontSize="10" fontFamily="Georgia, serif" fontStyle="italic">m³</text>
        <text x="120" y="257" textAnchor="middle" fill="#eed7b4" fontSize="8" fontFamily="sans-serif" letterSpacing="2">{gameUi("THINK DIFFERENTLY")}</text>
      </svg>
    </div>
  );
}
