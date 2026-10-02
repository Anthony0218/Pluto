import { useId } from "react";
import type { VariantCard } from "@/data/chessVariants";

/** Vector artwork only for the packaged, editable Pluto games. */
export default function CustomVariantArtwork({ variant, compact }: { variant: VariantCard; compact: boolean }) {
  const id = useId().replace(/:/g, "");
  const chaos = variant.customId === "pluto-chaos-chess";
  const long = variant.customId === "pluto-team-chess-long";
  const primary = chaos ? "#c4a2ff" : "#6de4d4";
  const enemy = chaos ? "#ed94d9" : "#ffba84";
  const crown = "M-13 4 -17-10 -7-4 0-15 7-4 17-10 13 4Z M-12 9H12";
  const label = chaos ? "ROYAL RUMBLE" : long ? "SIDE BY SIDE" : "TWO ALLIANCES";
  return <div className={`relative h-full overflow-hidden bg-[#080e15] ${compact ? "min-h-[180px]" : "min-h-[300px]"}`}>
    <svg viewBox="0 0 240 280" role="img" aria-label={`${variant.title}: ${chaos ? "a dragon between glowing portals" : long ? "allied armies side by side facing their opponents" : "four kings linked into two alliances"}`} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105">
      <defs>
        <radialGradient id={`${id}-halo`}><stop stopColor={primary} stopOpacity=".24" /><stop offset="1" stopColor={primary} stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-metal`} x2=".8" y2="1"><stop stopColor="#f0e6ff" /><stop offset=".5" stopColor={primary} /><stop offset="1" stopColor="#694d9c" /></linearGradient>
        <pattern id={`${id}-grid`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke={primary} strokeOpacity=".09" /></pattern>
      </defs>
      <rect width="240" height="280" fill={`url(#${id}-grid)`} />
      <ellipse cx="120" cy="134" rx="150" ry="140" fill={`url(#${id}-halo)`} />
      <path d="M18 42V22H38 M202 22H222V42 M18 238V258H38 M202 258H222V238" fill="none" stroke={primary} opacity=".35" />
      {chaos ? <>
        <g fill="none" stroke={primary}>
          <ellipse cx="61" cy="147" rx="25" ry="63" transform="rotate(-24 61 147)" strokeWidth="2" />
          <ellipse cx="61" cy="147" rx="32" ry="71" transform="rotate(-24 61 147)" opacity=".22" />
          <ellipse cx="177" cy="125" rx="25" ry="63" transform="rotate(24 177 125)" stroke={enemy} strokeWidth="2" />
          <path d="M40 191Q116 240 205 96 M32 159Q111 217 199 71" strokeDasharray="3 8" opacity=".5" />
        </g>
        <path d="M77 191 87 165 104 147 102 130 85 124 95 104 110 108 124 81 124 58 140 75 158 69 151 91 167 112 155 132 137 124 124 143 142 162 154 191Z" fill={`url(#${id}-metal)`} stroke="#e4d7ff" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M102 147 77 152 62 137 65 103 85 124 M124 143 136 156 134 175 M83 199H156" fill="none" stroke={primary} strokeWidth="3" strokeLinecap="round" />
        <path d="m132 100 10-3 -3 8Z" fill="#201b32" />
        {[[50,76],[192,197],[175,47]].map(([x,y]) => <path key={x} d={`M${x-5} ${y}h10 M${x} ${y-5}v10`} stroke={enemy} strokeWidth="1.5" />)}
      </> : <>
        <g transform={long ? "translate(32 96)" : "translate(48 68)"}>
          {Array.from({ length: long ? 8 : 10 }, (_, y) => Array.from({ length: long ? 16 : 10 }, (_, x) => {
            if (!long && (x < 2 || x > 7) && (y < 2 || y > 7)) return null;
            const size = long ? 11 : 14.4;
            return <rect key={`${x}-${y}`} x={x*size} y={y*size} width={size-1} height={size-1} rx="1" fill={(x+y)%2 ? primary : "#b8d4d9"} opacity={(x+y)%2 ? ".17" : ".07"} />;
          }))}
        </g>
        <path d={long ? "M72 69H168 M72 212H168 M120 90V190" : "M120 77V205 M57 140H183"} stroke={primary} strokeWidth="1.5" strokeDasharray="4 6" opacity=".5" />
        {(long ? [[72,64],[168,64],[72,215],[168,215]] : [[120,60],[40,140],[120,220],[200,140]]).map(([x,y], i) => {
          const color = long ? (i < 2 ? enemy : primary) : (i%2 ? enemy : primary);
          return <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="26" fill="#0c1820" stroke={color} strokeOpacity=".3" />
            <circle r="22" fill={color} fillOpacity=".07" />
            <path d={crown} fill={color} fillOpacity={i%2 ? ".35" : ".85"} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
          </g>;
        })}
        {long && <path d="m78 159 10-9 10 9 M142 159l10-9 10 9 M78 116l10 9 10-9 M142 116l10 9 10-9" fill="none" stroke={primary} strokeWidth="1.5" opacity=".6" />}
      </>}
      <text x="120" y="32" textAnchor="middle" fill={primary} opacity=".65" fontSize="7" fontFamily="sans-serif" letterSpacing="3">PLUTO ORIGINAL</text>
      <text x="120" y="258" textAnchor="middle" fill={primary} opacity=".7" fontSize="8" fontFamily="sans-serif" letterSpacing="2">{label}</text>
    </svg>
  </div>;
}
