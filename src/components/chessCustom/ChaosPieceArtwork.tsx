/** Pluto's fairy pieces: an astral wizard, a crescent dragon and a comet bomb. */
export function ChaosPieceArtwork({ icon, color, outline }: { icon: string; color: string; outline: string }) {
  return <g fill={color} stroke={outline} strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round">
    {icon === "🧙" && <>
      <path d="M23 78h54l-5 9H28zM34 75l5-24h22l5 24z" />
      <path d="M24 48c19-9 17-28 37-36-6 14-2 24 13 36z" />
      <path d="M29 48h44l6 6H23z" />
      <path d="M42 58l8 11 8-11" fill="none" />
      <path d="m54 28 2 4 4 1-4 2-2 4-1-4-4-2 4-1z" fill="#bba0ff" strokeWidth="1" />
      <circle cx="43" cy="57" r="2" fill={outline} stroke="none" /><circle cx="57" cy="57" r="2" fill={outline} stroke="none" />
      <path d="m78 19 2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#bba0ff" strokeWidth="1" />
    </>}
    {icon === "🐉" && <>
      <path d="M25 81h50l-4 7H29zM34 77c-11-15-5-31 13-39l-3-16 13 10 14-4-3 10 12 10-5 9-18-4c-14 6-15 16-5 24z" />
      <path d="M35 67 17 57l8-25 9 14 10-8M57 63l11-7 7 19-20-5" fill={color} />
      <path d="m49 37 8 7 13-3M34 48l-4 11 9 3" fill="none" />
      <path d="m61 39 5 2-5 3" fill="#7de5cf" strokeWidth="1.5" />
      <path d="M31 23c-9 2-10 13-4 17-12-1-14-19 0-23" fill="#7de5cf" strokeWidth="1.5" />
    </>}
    {(icon === "💣" || icon === "💥") && <>
      <path d="M25 81h50l-4 7H29z" />
      <circle cx="49" cy="57" r="25" />
      <path d="m54 33 4-9 12 5-4 10zM65 26c0-13 12-7 12-15" />
      <path d="M33 48c2-6 6-8 11-9" fill="none" stroke="#ffffff" strokeOpacity=".65" strokeWidth="4" />
      <path d="m49 47 3 7 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#ffbb66" strokeWidth="1.5" />
      <path d="m77 7 2-5M83 12l7-2M82 19l5 4M70 9l-4-4" fill="none" stroke="#ffbb66" strokeWidth="3" />
    </>}
  </g>;
}
