import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useState, type RefObject } from "react";
import type { Player } from "../../../games/party/types.ts";

// "Reconnecting… 42s" for a disconnected human, counting down to the server's bot-takeover deadline.
function ReconnectCountdown({ deadline, serverOffset }: { deadline: number; serverOffset: RefObject<number | null> }) {
  useGameLanguage();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const update = () =>
      setLeft(Math.max(0, Math.ceil((deadline - (Date.now() + (serverOffset.current ?? 0))) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deadline, serverOffset]);
  return <>{gameUi("Reconnecting…")}{gameUi(left !== null && left > 0 ? ` ${left}s` : "")}</>;
}
// One wording for a seat's controller everywhere (lobby slots, scoreboard). Text, not colour alone.
export default function PlayerStatus({
  player,
  serverOffset,
  human = "Explorer",
}: {
  player: Player;
  serverOffset: RefObject<number | null>;
  human?: string;
}) {
  useGameLanguage();
  if (player.botTakeover) return <>{gameUi("Bot (player left)")}</>;
  if (player.isBot) return <>{gameUi("Bot")}</>;
  if (!player.connected)
    return player.reconnectDeadline ? (
      <ReconnectCountdown deadline={player.reconnectDeadline} serverOffset={serverOffset} />
    ) : (
      <>{gameUi("Disconnected")}</>
    );
  return <>{gameUi(human)}</>;
}
