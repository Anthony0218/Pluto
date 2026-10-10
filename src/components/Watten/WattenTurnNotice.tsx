import { gameUi } from "../../i18n/gameUi.ts";
import { ui, useUiLanguage } from "@/i18n/ui";

export default function WattenTurnNotice({ player, active, mustFollow }: {
  player: string;
  active: boolean;
  mustFollow: boolean;
}) {
  useUiLanguage();
  if (!active) return null;
  return (
    <div role="status" className={`watten-turn-notice ${mustFollow ? "is-required" : ""}`}>
      <strong>{gameUi(player)}</strong>
      <span>{ui(mustFollow
        ? "Trumpf oder Kritisch! You must play one of the highlighted cards."
        : "Trumpf oder Kritisch — you have neither, so you may play any card.")}</span>
    </div>
  );
}
