import type { SeatInput } from "./engine/GameEngine.ts";
import type { GameDefinition, GameState, SettingValue } from "./engine/types.ts";

/**
 * Online rooms: the protocol shared by the `card-games` edge function and the
 * browser. A room waits for people to join with its code; when the host starts
 * it, every empty seat becomes a bot and the server runs the game.
 */

export const ROOM_CODE = /^[A-Z2-9]{6}$/;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function roomCode(): string {
  const random = crypto.getRandomValues(new Uint8Array(6));
  return [...random].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export const normalizeRoomCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

/** What a waiting room keeps in `state_json` until the game starts. */
export interface WaitingRoom {
  room: { capacity: number; settings: Record<string, SettingValue> };
}

export interface RoomMember {
  seat: number;
  name: string;
}

/** Seat ids are stable per room, so a player's id never reveals their account. */
export const seatPlayerId = (seat: number) => `seat-${seat}`;

/** The lowest seat a newcomer can take, or null when the room is full. */
export function freeSeat(capacity: number, taken: number[]): number | null {
  for (let seat = 0; seat < capacity; seat++) if (!taken.includes(seat)) return seat;
  return null;
}

/** Humans keep the seats they joined; every other seat below `capacity` becomes a bot. */
export function planRoomSeats(capacity: number, members: RoomMember[]): { seats: SeatInput[]; bots: RoomMember[] } {
  const bySeat = new Map(members.map((member) => [member.seat, member]));
  const bots: RoomMember[] = [];
  const seats: SeatInput[] = [];
  for (let seat = 0; seat < capacity; seat++) {
    const member = bySeat.get(seat);
    if (member) {
      seats.push({ id: seatPlayerId(seat), name: member.name });
      continue;
    }
    const bot = { seat, name: `Bot ${bots.length + 1}` };
    bots.push(bot);
    seats.push({ id: seatPlayerId(seat), name: bot.name, isBot: true });
  }
  return { seats, bots };
}

export interface RoomSeat {
  seat: number;
  name: string;
  isBot: boolean;
  isHost: boolean;
  isYou: boolean;
}

export interface RoomSnapshot {
  code: string;
  sessionId: string;
  versionId: string;
  status: "waiting" | "playing" | "finished";
  revision: number;
  capacity: number;
  settings: Record<string, SettingValue>;
  seats: RoomSeat[];
  youAreHost: boolean;
  /** Whether you hold a seat (otherwise you can join while it waits, or watch). */
  member: boolean;
  /** Your player id in `state`; null while waiting or when watching. */
  playerId: string | null;
  /** Your view of the game (hidden cards redacted); null while waiting. */
  state: GameState | null;
  /** Sent when the client asks for it — it never changes during a room. */
  definition?: GameDefinition;
}
