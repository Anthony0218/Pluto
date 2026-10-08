import { COLORS } from "../../../games/party/config.ts";
import type { Player } from "../../../games/party/types.ts";
import { CHARACTER_NAMES } from "./minigames/characterRoster.ts";
import { CharacterFace } from "./CharacterFace.tsx";
export default function Portrait({ player }: { player: Pick<Player, "avatarId" | "name"> }) {
  return <span className="pp-portrait pp-crew-portrait" style={{ background: COLORS[player.avatarId] + "24" }} aria-label={`${player.name} · ${CHARACTER_NAMES[player.avatarId % 4]}`}><CharacterFace avatarId={player.avatarId}/></span>;
}
