import { useEffect, useState } from "react";
import { useCardGameRepository } from "@/games/cards/storage/useCardGameRepository";
import { latestPublished } from "@/games/cards/versioning";
import { INVITE_GAMES, type InviteMode } from "./gameCreationCatalog";

/** Friend and clan invitations offer the same casual rooms, including published card games. */
export function useInviteGames(gameId: string) {
  const { repository } = useCardGameRepository();
  const [cardModes, setCardModes] = useState<InviteMode[]>([]);
  const [cardsError, setCardsError] = useState("");
  useEffect(() => {
    if (gameId !== "card-builder" || repository.kind !== "cloud") return;
    let active = true;
    void repository.list().then(records => {
      if (!active) return;
      setCardModes(records.flatMap(record => {
        const version = latestPublished(record);
        return version ? [{ id: version.id, label: `${record.name} · v${version.version}`, route: `/games/card-builder/play?game=${record.id}&version=${version.id}&mode=online`, inviteRoute: "/games/card-builder/room" }] : [];
      }));
      setCardsError("");
    }).catch(() => { if (active) setCardsError("Published games could not be loaded. Select Card Builder again to retry."); });
    return () => { active = false; };
  }, [gameId, repository]);
  const games = INVITE_GAMES.filter(game => game.modes.length || game.id === "card-builder")
    .map(game => game.id === "card-builder" ? { ...game, modes: cardModes } : game);
  return { games, cardsError, clearCardsError: () => setCardsError("") };
}
