/**
 * What each game's planet shows on its surface, as SVG markup in a 100x100 box that the round sphere crops. The CSS planets
 * place it inside the sphere; the travelling WebGL planet paints it into a texture (see JourneyCanvas), so it is plain
 * markup with no styles of its own. Tones without an entry keep the plain planet.
 */

const FELT = { schafkopf: "#0f9a72", watten: "#cc3b77" };
const WATTEN_CARDS = ["/images/landing/watten-schellen-7.png", "/images/landing/watten-herz-king.png", "/images/landing/watten-eichel-7.png"];
const SCHAFKOPF_CARDS = ["/images/schafkopf/bayerisches-blatt/gras-ober.png", "/images/schafkopf/bayerisches-blatt/herz-ober.png", "/images/schafkopf/bayerisches-blatt/eichel-ober.png"];

/** Three cards fanned from the bottom, the middle one on top. `ratio` is card height over width. */
function cardFan(felt: string, cards: string[], width: number, ratio: number) {
  const height = width * ratio;
  const fan = [[0, -27], [2, 27], [1, 0]].map(([which, angle]) =>
    `<g transform="translate(50 92) rotate(${angle})"><image href="${cards[which]}" x="${-width / 2}" y="${-height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/></g>`);
  return `<rect width="100" height="100" fill="${felt}"/>${fan.join("")}`;
}

const checker = Array.from({ length: 36 }, (_, k) => (k % 6 + Math.floor(k / 6)) & 1 ? "" : `<rect x="${-25 + (k % 6) * 25}" y="${-25 + Math.floor(k / 6) * 25}" width="25" height="25" fill="#5b43c9"/>`).join("");
const goLines = Array.from({ length: 9 }, (_, k) => `<line x1="${-12 + k * 15}" y1="-20" x2="${-12 + k * 15}" y2="120"/><line x1="-20" y1="${-12 + k * 15}" x2="120" y2="${-12 + k * 15}"/>`).join("");
const goStones = [[48, 48, "#101322"], [63, 33, "#101322"], [33, 63, "#101322"], [63, 48, "#f6f7ff"], [48, 63, "#f6f7ff"], [33, 33, "#f6f7ff"]]
  .map(([x, y, fill]) => `<circle cx="${x}" cy="${y}" r="6" fill="${fill}" stroke="#00000040" stroke-width=".6"/>`).join("");
// Eat It, as on the game's cover: the monster with its mouth open, the City floor, and the food it is about to eat.
const food = {
  apple: `<ellipse cx="-5" rx="11" ry="14" fill="#e77767"/><ellipse cx="5" rx="11" ry="14" fill="#ee806c"/><path d="M0-11v-9" stroke="#7c664d" stroke-width="3"/><ellipse cx="8" cy="-17" rx="8" ry="4" fill="#82a367" transform="rotate(-22 8 -17)"/>`,
  burger: `<rect x="-23" y="8" width="46" height="12" rx="6" fill="#e8b461"/><rect x="-24" width="48" height="10" rx="5" fill="#805748"/><rect x="-27" y="-4" width="54" height="5" rx="2" fill="#9bae5e"/><path d="M-24-7a24 19 0 0148 0z" fill="#f0c473"/>`,
  donut: `<circle r="15" fill="#d9ac6d"/><circle cy="-1" r="13" fill="#e8a0b6"/><circle r="5" fill="#8e7460"/>`,
};
const monster = `<circle cx="3" cy="7" r="64" fill="#485447" opacity=".15"/><circle r="64" fill="#bfdd76"/><circle cx="8" r="42" fill="#3a2a3d"/><circle cx="10" r="37" fill="#171829"/><circle cx="12" r="26" fill="#0b0d19"/>
  <path d="M20 31q18-6 24-2Q30 42 16 37z" fill="#ca7089"/><rect x="-6" y="-37" width="11" height="8" rx="2" fill="#fff7dc"/><rect x="-6" y="29" width="11" height="8" rx="2" fill="#fff7dc"/>
  <ellipse cx="-42" cy="-30" rx="12" ry="13" fill="#fffdf0"/><ellipse cx="-42" cy="30" rx="12" ry="13" fill="#fffdf0"/><circle cx="-38" cy="-30" r="6" fill="#202735"/><circle cx="-38" cy="30" r="6" fill="#202735"/>`;

export const planetSurfaces: Record<string, string> = {
  chess: `<g transform="rotate(-18 50 50)"><rect x="-30" y="-30" width="160" height="160" fill="#e3dcff"/>${checker}</g>`,
  go: `<g transform="rotate(-12 50 50)"><rect x="-20" y="-20" width="140" height="140" fill="#dca95e"/><g stroke="#6b4a1f" stroke-width="1">${goLines}</g>${goStones}</g>`,
  schafkopf: cardFan(FELT.schafkopf, SCHAFKOPF_CARDS, 34, 1.55),
  watten: cardFan(FELT.watten, WATTEN_CARDS, 27, 2),
  atlas: `<rect width="100" height="100" fill="#1a86d6"/>
    <path d="M6 34Q22 14 42 22 48 38 34 46 24 54 20 70 6 60 6 34Z" fill="#5dbb6e"/><path d="M56 46Q72 34 88 48 94 66 78 80 70 92 64 100 48 82 56 46Z" fill="#5dbb6e"/><path d="M60 10Q80 4 94 18 86 30 66 28Z" fill="#7cc98a"/>
    <g fill="none" stroke="#ffffff55" stroke-width=".8"><ellipse cx="50" cy="50" rx="46" ry="15"/><ellipse cx="50" cy="50" rx="16" ry="46"/><line x1="4" y1="50" x2="96" y2="50"/></g>
    <path d="M50 18a11 11 0 0 1 11 11c0 9-11 22-11 22S39 38 39 29a11 11 0 0 1 11-11Z" fill="#ffd25e" stroke="#7a4a00" stroke-width="1.6"/><circle cx="50" cy="29" r="4" fill="#7a4a00"/>`,
  natura: `<rect width="100" height="100" fill="#8fd25a"/><path d="M-5 68Q28 48 58 64T105 58V105H-5Z" fill="#43962f"/><path d="M50 14C80 28 82 64 50 88 18 64 20 28 50 14Z" fill="#2f7d2b"/>
    <path d="M50 20V84M50 40 36 30M50 40 64 30M50 56 34 46M50 56 66 46" stroke="#bff59a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="30" r="5" fill="#fff"/><circle cx="20" cy="30" r="2" fill="#ffd25e"/><circle cx="82" cy="74" r="5" fill="#fff"/><circle cx="82" cy="74" r="2" fill="#ffd25e"/>`,
  "eat-it": `<rect width="100" height="100" fill="#e7dfc7"/><path d="M0 0H100M0 33H100M0 66H100M33 0V100M66 0V100" stroke="#d8d2bd" stroke-width="1.2"/>
    <g transform="translate(80 24) rotate(-14) scale(.55)">${food.burger}</g><g transform="translate(86 56) scale(.7)">${food.donut}</g><g transform="translate(74 84) rotate(12) scale(.55)">${food.apple}</g>
    <g transform="translate(38 54) rotate(-6) scale(.56)">${monster}</g>`,
};

/** The journey's tone names differ from the config's in one place ("eatit"). */
export const surfaceKey = (tone: string | undefined) => {
  const key = tone === "eatit" ? "eat-it" : tone;
  return key && key in planetSurfaces ? key : undefined;
};
/** Chess and Go keep their pieces standing on the rim; on the other surfaces the extra symbols would only clutter. */
export const rimPieces = new Set(["chess", "go"]);
