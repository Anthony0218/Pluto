import { TONES, type ToneName } from "../../landing/tones";

/** Each game's colour is its planet's colour on the landing page, and learning has the Learn tab's gold. Anything missing here gets a neutral grey. */
const toneOfGame: Record<string, ToneName> = {
  "chess": "chess", "go": "go", "watten": "watten", "schafkopf": "schafkopf",
  "atlas-arena": "atlas", "natura": "natura", "eat-it": "eatit", "pluto-party": "party", "learning": "learn",
};
export const gameColor = (subject: string) => { const tone = toneOfGame[subject]; return tone ? TONES[tone].glow : "#94a3b8"; };
