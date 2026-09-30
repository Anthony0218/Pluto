import { COLORS } from "../../../games/party/config.ts";
import type { Player } from "../../../games/party/types.ts";
export default function Portrait({
  player,
}: {
  player: Pick<Player, "avatarId" | "name">;
}) {
  return (
    <span
      className="pp-portrait"
      style={{ background: COLORS[player.avatarId] }}
      aria-label={`${player.name}'s pawn`}
    >
      <i />
      <i />
      <b />
    </span>
  );
}
