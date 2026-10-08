import { minigameRegistry } from "../minigames/index.ts";
import { mapRegistry } from "../content/maps.ts";
import { NAME_LIMITS } from "../config.ts";
import type {
  ClientMessage,
  Difficulty,
  DuelWager,
  MinigameInput,
  Settings,
} from "../types.ts";
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 60): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
// C0/C1 controls, zero-width and bidi-override characters (they can hide or reorder text in the UI).
const invisible = (c: number) =>
  c <= 0x1f ||
  (c >= 0x7f && c <= 0x9f) ||
  (c >= 0x200b && c <= 0x200f) ||
  (c >= 0x2028 && c <= 0x202e) ||
  (c >= 0x2060 && c <= 0x206f) ||
  c === 0xfeff;
// Display names: control and zero-width characters removed, whitespace collapsed, 1..max characters.
// Names are only ever rendered as React text (never as HTML).
export function cleanName(v: unknown, max: number): string | null {
  if (typeof v !== "string" || v.length > max * 4) return null;
  const name = [...v.normalize("NFC")]
    .map((ch) => (/\s/.test(ch) ? " " : ch))
    .filter((ch) => !invisible(ch.codePointAt(0)!))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return name.length > 0 && [...name].length <= max ? name : null;
}
// Lobby codes are PLUTO-###### (server generated). Accepts any case, surrounding spaces, and the digits
// alone ("482193" or "pluto 482193"); returns null for anything that cannot be a code.
export function normalizeLobbyCode(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 20) return null;
  const digits = /^\s*(?:pluto[\s-]*)?(\d{6})\s*$/i.exec(v);
  return digits ? `PLUTO-${digits[1]}` : null;
}
// Session tokens are server-issued UUIDs; anything else is treated as "no token".
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Minigame input is only bounded here (a few short primitive fields); the active minigame parses it.
function minigameInput(v: unknown): MinigameInput | null {
  if (!record(v)) return null;
  const entries = Object.entries(v);
  if (!entries.length || entries.length > 8) return null;
  for (const [key, field] of entries)
    if (
      key.length > 24 ||
      !(
        (typeof field === "string" && field.length <= 40) ||
        (typeof field === "number" && Number.isFinite(field)) ||
        typeof field === "boolean"
      )
    )
      return null;
  return Object.fromEntries(entries) as MinigameInput;
}
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
// Only the wager's kind and amount are read; the server re-validates both players can fund it.
function duelWager(v: unknown): DuelWager | null {
  if (!record(v)) return null;
  if (v.type === "pluto" && (v.amount === undefined || v.amount === 1))
    return { type: "pluto", amount: 1 };
  if (v.type === "coins" && Number.isInteger(v.amount) && finite(v.amount, 1, 100000))
    return { type: "coins", amount: v.amount };
  return null;
}
export const difficulty = (v: unknown): v is Difficulty =>
  v === "beginner" || v === "easy" || v === "medium" || v === "hard" || v === "extreme";
export function validSettings(v: unknown): v is Settings {
  return (
    record(v) &&
    (v.mode === undefined || v.mode === "board" || v.mode === "festival") &&
    (v.roundLimit === undefined || [0, 3, 5, 8, 12, 16].includes(Number(v.roundLimit)) && typeof v.roundLimit === "number") &&
    (v.mode !== "festival" || Number(v.roundLimit) > 0) &&
    (v.minigameIds === undefined || Array.isArray(v.minigameIds) && v.minigameIds.length <= 20 && new Set(v.minigameIds).size === v.minigameIds.length && v.minigameIds.every((id) => typeof id === "string" && minigameRegistry.pool("main").some((game) => game.id === id))) &&
    typeof v.mapId === "string" &&
    mapRegistry.all().some((map) => map.id === v.mapId) &&
    (v.victory === "plutos" || v.victory === "coins") &&
    [3, 5, 7, 10].includes(Number(v.plutoTarget)) &&
    typeof v.plutoTarget === "number" &&
    [100, 150, 200, 250, 300].includes(Number(v.coinTarget)) &&
    typeof v.coinTarget === "number" &&
    difficulty(v.difficulty) &&
    typeof v.fillBots === "boolean"
  );
}
export function parseMessage(value: unknown): ClientMessage {
  if (!record(value)) throw new Error("Invalid message.");
  switch (value.type) {
    case "HELLO":
      return {
        type: "HELLO",
        token:
          typeof value.token === "string" && TOKEN.test(value.token)
            ? value.token
            : undefined,
      };
    case "LIST":
      if (typeof value.query === "string" && value.query.length <= 60)
        return { type: "LIST", query: value.query };
      break;
    case "CREATE": {
      const name = cleanName(value.name, NAME_LIMITS.lobby),
        playerName = cleanName(value.playerName, NAME_LIMITS.player);
      if (!name)
        throw new Error(`Lobby names need 1–${NAME_LIMITS.lobby} characters.`);
      if (!playerName)
        throw new Error(`Explorer names need 1–${NAME_LIMITS.player} characters.`);
      if (typeof value.public === "boolean")
        return { type: "CREATE", name, playerName, public: value.public };
      break;
    }
    case "JOIN": {
      const code = normalizeLobbyCode(value.code),
        playerName = cleanName(value.playerName, NAME_LIMITS.player);
      if (!code) throw new Error("That is not a lobby code. Codes look like PLUTO-123456.");
      if (!playerName)
        throw new Error(`Explorer names need 1–${NAME_LIMITS.player} characters.`);
      return { type: "JOIN", code, playerName };
    }
    case "READY":
      if (typeof value.ready === "boolean")
        return { type: "READY", ready: value.ready };
      break;
    case "SETTINGS":
      if (validSettings(value.settings))
        return { type: "SETTINGS", settings: value.settings };
      break;
    case "ADD_BOT":
    case "START":
    case "LEAVE":
    case "RETURN_TO_LOBBY":
    case "PING":
      return { type: value.type };
    case "REMOVE":
      if (str(value.playerId, 100))
        return { type: "REMOVE", playerId: value.playerId };
      break;
    case "BOT_DIFFICULTY":
      if (str(value.playerId, 100) && difficulty(value.difficulty))
        return {
          type: "BOT_DIFFICULTY",
          playerId: value.playerId,
          difficulty: value.difficulty,
        };
      break;
    case "ACTION":
      if (record(value.action)) {
        if (value.action.type === "ZERO_REWARD" && (value.action.reward === "heal" || value.action.reward === "coins")) return { type: "ACTION", action: { type: "ZERO_REWARD", reward: value.action.reward } };
        if (value.action.type === "BUY_ITEM" && typeof value.action.mystery === "boolean" && (value.action.itemId === undefined || str(value.action.itemId, 40))) return { type: "ACTION", action: { type: "BUY_ITEM", mystery: value.action.mystery, ...(value.action.itemId !== undefined && { itemId: value.action.itemId }) } };
        if (
          value.action.type === "MINIGAME_READY" ||
          value.action.type === "ROLL_DICE" ||
          value.action.type === "BUY_PLUTO" ||
          value.action.type === "LEAVE_PLUTO" ||
          value.action.type === "LEAVE_PROPERTY"
        )
          return { type: "ACTION", action: { type: value.action.type } };
        if (
          (value.action.type === "BUY_PROPERTY" ||
            value.action.type === "UPGRADE_PROPERTY") &&
          str(value.action.nodeId, 40)
        )
          return {
            type: "ACTION",
            action: { type: value.action.type, nodeId: value.action.nodeId },
          };
        if (value.action.type === "DECLINE_TRANSPORT")
          return { type: "ACTION", action: { type: "DECLINE_TRANSPORT" } };
        if (value.action.type === "RIDE_TRANSPORT" && str(value.action.transportId, 40))
          return {
            type: "ACTION",
            action: { type: "RIDE_TRANSPORT", transportId: value.action.transportId },
          };
        if (value.action.type === "DISCARD_NEW_ITEM")
          return { type: "ACTION", action: { type: "DISCARD_NEW_ITEM" } };
        if (
          value.action.type === "REPLACE_ITEM" &&
          str(value.action.replaceInstanceId, 40)
        )
          return {
            type: "ACTION",
            action: {
              type: "REPLACE_ITEM",
              replaceInstanceId: value.action.replaceInstanceId,
            },
          };
        if (
          value.action.type === "USE_ITEM" &&
          str(value.action.itemInstanceId, 40) &&
          (value.action.targetNodeId === undefined ||
            str(value.action.targetNodeId, 40)) &&
          (value.action.targetPlayerId === undefined ||
            str(value.action.targetPlayerId, 100)) &&
          (value.action.wager === undefined || duelWager(value.action.wager))
        )
          return {
            type: "ACTION",
            action: {
              type: "USE_ITEM",
              itemInstanceId: value.action.itemInstanceId,
              ...(value.action.targetNodeId !== undefined && {
                targetNodeId: value.action.targetNodeId,
              }),
              ...(value.action.targetPlayerId !== undefined && {
                targetPlayerId: value.action.targetPlayerId,
              }),
              ...(value.action.wager !== undefined && {
                wager: duelWager(value.action.wager)!,
              }),
            },
          };
        // Aim release: a bounded reticle position and elapsed time only. Anything else is dropped.
        if (
          value.action.type === "FIRE_ITEM" &&
          finite(value.action.aimX, -1.5, 1.5) &&
          finite(value.action.aimY, -1.5, 1.5) &&
          (value.action.elapsedMs === undefined ||
            finite(value.action.elapsedMs, 0, 60000))
        )
          return {
            type: "ACTION",
            action: {
              type: "FIRE_ITEM",
              aimX: value.action.aimX,
              aimY: value.action.aimY,
              ...(value.action.elapsedMs !== undefined && {
                elapsedMs: value.action.elapsedMs,
              }),
            },
          };
        if (value.action.type === "CANCEL_AIM")
          return { type: "ACTION", action: { type: "CANCEL_AIM" } };
        if (value.action.type === "MINIGAME_INPUT") {
          const input = minigameInput(value.action.input);
          if (input)
            return { type: "ACTION", action: { type: "MINIGAME_INPUT", input } };
        }
        if (value.action.type === "SELECT_PATH" && str(value.action.nodeId, 40))
          return {
            type: "ACTION",
            action: { type: "SELECT_PATH", nodeId: value.action.nodeId },
          };
      }
      break;
  }
  throw new Error("Invalid or unsupported action.");
}
