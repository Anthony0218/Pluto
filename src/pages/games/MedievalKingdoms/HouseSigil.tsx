import { useGameLanguage } from "../../../i18n/gameUi.ts";
import type { House } from "../../../games/MedievalKingdoms/edravane/types.ts";

// Original vector heraldry. House identity selects the charge and the shield's ordinary.
const charges: Record<string, string> = {
  auremarch: "M12 31V17h4v-4h3v4h3v-4h3v4h3v14Zm6 0v-6h4v6M12 21h16",
  "high-cairn": "m8 30 9-17 6 10 4-6 7 13Zm9-17-3 8 4-2 5 4",
  saltmere: "M20 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 6v14m-7-10h14M9 27q0 8 11 8 11 0 11-8m-22 0 4 3m18-3-4 3",
  dunwald: "M20 34V22m-7 13h14M20 13c-6-5-11 3-7 6-6 2-4 10 3 9 2 3 6 3 8 0 7 1 9-7 3-9 4-3-1-11-7-6Z",
  varnesk: "M20 12v24M10 18l20 12M10 30l20-12m-13-3 3 3 3-3m-6 18 3-3 3 3m-10-13 1 4-4 1m20-1-4 1 1 4m-16 0 4-1-1 4m16-12-4 1 1-4",
  sylvarenne: "m20 12 3 9 9 3-9 3-3 9-3-9-9-3 9-3Zm-11 1 3 3m16 16 3 3m0-22-3 3M12 32l-3 3",
  "ilyr-coast": "M20 18a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0-7v3m0 20v3M7 24h3m20 0h3M11 15l2 2m14 14 2 2m0-18-2 2M13 31l-2 2",
  graskor: "m20 12 11 12-11 12L9 24Zm0 5 6 7-6 7-6-7Zm-12-2 4 1m16 16 4 1",
  resource: "M20 35V14m0 8c-9 0-9-8-9-8s9 0 9 8Zm0 8c9 0 9-8 9-8s-9 0-9 8Z",
  frontier: "m12 13 2 7 15 15 4-4-15-15Zm-4 16 8-8m-4 12 5 5m11-25-2 6m-7 10-5 6",
  trade: "M20 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 6v14m-7-10h14M9 27q0 8 11 8 11 0 11-8m-22 0 4 3m18-3-4 3",
  claimant: "M10 18v13h20V18l-6 4-4-9-4 9Zm0 9h20",
};

function sigilVariant(id: string) {
  let hash = 0;
  for (const character of id) hash = Math.imul(hash, 31) + character.charCodeAt(0) | 0;
  return (hash >>> 0) % 4;
}

export function HouseSigil({ house, size = 28 }: { house: House; size?: number }) {
  useGameLanguage();
  const variant = sigilVariant(house.id);
  const ordinary = ["M6 9h14v30l-14-9Z", "M6 11 34 31v-8L15 9H6Z", "M6 24l14-10 14 10v8L20 22 6 32Z", "M17 9h6v27l-3 3-3-3Z"][variant];
  return <svg className="ed-house-sigil" width={size} height={size * 1.2} viewBox="0 0 40 48" fill="none" aria-hidden="true" focusable="false">
    <path d="M3 4h34v23c0 10-10 15-17 18C13 42 3 37 3 27Z" fill="#142b25" stroke="#e4d3a1" strokeWidth="1.1" />
    <path d="M6 9h28v18c0 7-8 12-14 15C14 39 6 34 6 27Z" fill={house.color} />
    <path d={ordinary} fill="#172d28" opacity=".32" />
    <path d={charges[house.role === "crown" ? house.nation : house.role] ?? charges.claimant} stroke="#fff1c2" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    {house.role === "crown" && <path d="m11 6-1-4 5 2 5-3 5 3 5-2-1 4Z" fill="#f6d97b" />}
  </svg>;
}
