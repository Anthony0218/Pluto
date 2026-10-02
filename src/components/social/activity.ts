/* What friends see about each other: the game and mode, never the room. */
import { ui } from "@/i18n/ui";

export const profileRoute = (userId: string) => `/profile/${encodeURIComponent(userId)}`;
export const profileNameRoute = (username: string) => `/profile/name/${encodeURIComponent(username)}`;

export type Activity = { game: string; mode: string | null };

export type FriendPresence = {
  lastSeenAt: string;
  online: boolean;
  game: string | null;
  mode: string | null;
  /** The friend is inside a live room that can be watched. */
  spectatable: boolean;
};

/** Presence rows older than this count as offline (heartbeat runs every 30 s). */
export const ONLINE_WINDOW_MS = 90_000;

const gameRoutes: [prefix: string, game: string][] = [
  ["/chess-custom", "Custom Chess"],
  ["/games/chess", "Chess"],
  ["/games/pluto-party", "Pluto Party"],
  ["/games/eat-it", "Eat It"],
  ["/games/atlas-arena", "Atlas Arena"],
  ["/games/go", "Go"],
  ["/games/shogi", "Shogi"],
  ["/games/schafkopf", "Schafkopf"],
  ["/games/watten", "Watten"],
  ["/games/medieval-kingdoms", "Medieval Kingdoms"],
  ["/games/card-builder", "Card Builder"],
  ["/games/natura", "Natura"],
];

const modes: [pattern: RegExp, mode: string][] = [
  [/\/ranked(\/|$)/, "Ranked"],
  [/\/multiplayer(\/|$)/, "Multiplayer"],
  [/\/(ai|singleplayer|computer)(\/|$)/, "vs AI"],
  [/\/hotseat(\/|$)/, "Hotseat"],
  [/\/puzzles(\/|$)/, "Puzzles"],
  [/\/analysis(\/|$)/, "Analysis"],
  [/\/rules(\/|$)/, "Rules"],
];

export function activityForPath(pathname: string): Activity | null {
  const match = gameRoutes.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!match) return null;
  const mode = modes.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
  return { game: match[1], mode };
}

/** Only live chess rooms can be watched; mirrors public.spectatable_room_code. */
export function isSpectatableRoute(pathname: string) {
  return /^\/games\/chess\/(?:classic\/multiplayer|ranked)\/[A-Za-z0-9]{6}(?:\/game)?$/.test(pathname);
}

export function canRequestSpectate(presence: FriendPresence | undefined) {
  return !!presence?.online && presence.spectatable;
}

/** "5 minutes", "4 hours", "2 days" — callers wrap it as "Offline for …". */
export function offlineDuration(lastSeenAt: string, now = Date.now()) {
  const minutes = Math.max(1, Math.floor((now - Date.parse(lastSeenAt)) / 60_000));
  if (minutes < 60) return { value: minutes, unit: minutes === 1 ? "minute" : "minutes" } as const;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { value: hours, unit: hours === 1 ? "hour" : "hours" } as const;
  const days = Math.floor(hours / 24);
  if (days < 30) return { value: days, unit: days === 1 ? "day" : "days" } as const;
  const months = Math.floor(days / 30);
  return { value: months, unit: months === 1 ? "month" : "months" } as const;
}

/** "Playing Chess · Ranked", "Online now" or "Offline for 4 hours". */
export function presenceText(presence: FriendPresence | undefined, online: boolean) {
  if (online) {
    if (!presence?.game) return ui("Online now");
    if (!presence.mode || presence.mode === "Rules") return `${ui("Browsing")} ${ui(presence.game)}`;
    return `${ui("Playing")} ${ui(presence.game)} · ${ui(presence.mode)}`;
  }
  if (!presence?.lastSeenAt) return ui("Offline");
  const { value, unit } = offlineDuration(presence.lastSeenAt);
  return ui(`Offline for {count} ${unit}`).replace("{count}", String(value));
}
