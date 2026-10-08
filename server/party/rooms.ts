import { randomInt, randomUUID } from "node:crypto";
import {
  DEFAULT_SETTINGS,
  NETWORK_CONFIG,
} from "../../src/games/party/config.ts";
import {
  activePlayer,
  advance,
  applyAction,
  createMatch,
  createPlayer,
  mapOf,
} from "../../src/games/party/engine/engine.ts";
import { botAction, safeBotAction } from "../../src/games/party/engine/bots.ts";
import {
  isMinigamePlayPhase,
  publicMinigameView,
  stepMinigameBots,
} from "../../src/games/party/minigames/flow.ts";
import { minigameRegistry } from "../../src/games/party/minigames/index.ts";
import { normalizeLobbyCode } from "../../src/games/party/network/protocol.ts";
import type {
  ClientMessage,
  GameAction,
  Lobby,
  Match,
  Player,
  ServerMessage,
} from "../../src/games/party/types.ts";
import { PartyError, isExpectedError } from "./errors.ts";
import { RateLimiter } from "./limits.ts";
import { log, logStack } from "./log.ts";
// One session per browser tab (the token lives in sessionStorage). The token is the reconnect secret and
// is never broadcast; `id` is the public player id. A session is bound to at most one socket at a time.
export interface Session {
  token: string;
  id: string;
  room: string | null;
  send: ((message: ServerMessage) => void) | null;
  // Closes the socket currently bound to this session (a newer connection replaces an older one).
  close: ((code: number, reason: string) => void) | null;
  disconnectedAt: number | null;
  // Client address used only as a rate-limit key; never sent to clients.
  address: string;
}
export interface ConnectOptions {
  close?: Session["close"];
  address?: string;
  now?: number;
}
const random = () => randomInt(0, 0x1000000) / 0x1000000;
// While a minigame runs, bot inputs and snapshots are paced by the fast tick: changes are batched to at
// most one broadcast per MIN interval, and the (trimmed) target window is refreshed every MAX interval.
const MINIGAME_BROADCAST_MIN_MS = 200,
  MINIGAME_BROADCAST_MAX_MS = 1000;
// Snapshots reduce minigame state to its public view; private challenges are scoped to the session.
// Timed client views (minigames, aiming) also get the server clock so they can sync.
export function publicLobby(room: Lobby, now = Date.now(), viewerId?: string): Lobby {
  const match = room.match;
  if (!match?.minigame && !match?.turn.aim) return room;
  return {
    ...room,
    match: {
      ...match,
      minigame: match.minigame && publicMinigameView(match.minigame, now, undefined, viewerId),
      turn: match.turn.aim
        ? { ...match.turn, aim: { ...match.turn.aim, serverNow: now } }
        : match.turn,
    },
  };
}
const FAST_PHASES = new Set(["MINIGAME_INTRO", "MINIGAME", "DUEL_INTRO", "DUEL_MINIGAME"]);
const sameAction = (a: GameAction, b: GameAction) => JSON.stringify(a) === JSON.stringify(b);
// Fresh pre-match copies of the players that stay in a lobby (same ids, names, seats and bot settings).
function lobbyPlayers(players: Player[]): Player[] {
  return players.map((p) => {
    const fresh = createPlayer(p.id, p.name, p.avatarId, p.isBot);
    fresh.difficulty = p.difficulty;
    fresh.connected = p.connected;
    fresh.reconnectDeadline = p.reconnectDeadline ?? null;
    return fresh;
  });
}
export class PartyRooms {
  rooms = new Map<string, Lobby>();
  sessions = new Map<string, Session>();
  private lastBroadcast = new Map<string, number>();
  private dirty = new Set<string>();
  // Consecutive unexpected engine errors per room (reset by any successful tick).
  private failures = new Map<string, number>();
  private creates = new RateLimiter(NETWORK_CONFIG.lobbyCreatesPerMinute, 60_000);
  private lookups = new RateLimiter(NETWORK_CONFIG.codeLookupsPerMinute, 60_000);
  // Injectable for tests; production always uses the shared bot heuristics.
  private decide: typeof botAction;
  constructor(options: { botDecision?: typeof botAction } = {}) {
    this.decide = options.botDecision ?? botAction;
  }
  // Binds a socket to a session. A valid token resumes the old session (same player id, same seat); a
  // second connection with the same token replaces the first, which is told why and closed, so two
  // sockets can never control one player.
  connect(
    token: string | undefined,
    send: Session["send"],
    options: ConnectOptions = {},
  ): Session {
    const now = options.now ?? Date.now();
    let session = token ? this.sessions.get(token) : undefined;
    const resumed = !!session;
    if (!session) {
      session = {
        token: randomUUID(),
        id: randomUUID(),
        room: null,
        send: null,
        close: null,
        disconnectedAt: null,
        address: options.address ?? "local",
      };
      this.sessions.set(session.token, session);
    } else if (session.send && session.send !== send) {
      session.send({
        type: "ERROR",
        code: "SESSION_REPLACED",
        message: "This game was opened in another tab or window.",
      });
      session.close?.(4001, "Session replaced");
      log.info("session.replaced", { player: session.id, room: session.room });
    }
    const wasDisconnected = session.disconnectedAt !== null;
    session.send = send;
    session.close = options.close ?? null;
    session.address = options.address ?? session.address;
    session.disconnectedAt = null;
    send?.({
      type: "SESSION",
      token: session.token,
      playerId: session.id,
      resumed,
      reconnectGraceMs: NETWORK_CONFIG.reconnectGraceMs,
    });
    const room = session.room ? this.rooms.get(session.room) : undefined;
    if (room) {
      const player = room.players.find((p) => p.id === session.id);
      if (player) {
        // Takeover-back: a returning human reclaims their seat from the bot with all state intact.
        if (player.botTakeover) log.info("seat.reclaimed", { room: room.code, player: player.id });
        player.connected = true;
        player.isBot = false;
        player.botTakeover = false;
        player.reconnectDeadline = null;
      }
      if (wasDisconnected)
        log.info("player.reconnected", { room: room.code, player: session.id, phase: room.match?.phase ?? "LOBBY" });
      this.broadcast(room, now);
    } else {
      if (session.room) session.room = null;
      send?.({ type: "STATE", lobby: null, serverNow: now });
    }
    return session;
  }
  disconnect(session: Session, now = Date.now()) {
    session.send = null;
    session.close = null;
    session.disconnectedAt = now;
    const room = session.room ? this.rooms.get(session.room) : undefined;
    const player = room?.players.find((p) => p.id === session.id);
    if (room && player) {
      player.connected = false;
      if (!player.isBot) player.reconnectDeadline = now + NETWORK_CONFIG.reconnectGraceMs;
      log.info("player.disconnected", { room: room.code, player: player.id, phase: room.match?.phase ?? "LOBBY" });
      this.broadcast(room, now);
    }
  }
  broadcast(room: Lobby, now = Date.now()) {
    const personalized = room.match?.minigame && minigameRegistry.get(room.match.minigame.minigameId).personalizedView;
    const sharedLobby = personalized ? null : publicLobby(room, now);
    this.lastBroadcast.set(room.code, now);
    this.dirty.delete(room.code);
    for (const session of this.sessions.values())
      if (session.room === room.code)
        session.send?.({ type: "STATE", lobby: sharedLobby ?? publicLobby(room, now, session.id), serverNow: now });
  }
  private deleteRoom(code: string, reason: string) {
    if (!this.rooms.delete(code)) return;
    this.lastBroadcast.delete(code);
    this.dirty.delete(code);
    this.failures.delete(code);
    log.info("lobby.deleted", { room: code, reason });
  }
  // Host rule everywhere: the oldest (earliest-joined) connected human, else the oldest human. A host who
  // is only briefly disconnected (still inside the grace period) keeps the role; one whose seat left or was
  // handed to a bot does not.
  private reassignHost(room: Lobby) {
    const current = room.players.find((p) => p.id === room.hostId);
    if (current && !current.isBot && !current.botTakeover) return;
    const next =
      room.players.find((p) => !p.isBot && p.connected) ??
      room.players.find((p) => !p.isBot);
    if (next && next.id !== room.hostId) {
      room.hostId = next.id;
      log.info("lobby.host", { room: room.code, host: next.id });
    }
  }
  leave(session: Session) {
    const room = session.room ? this.rooms.get(session.room) : undefined;
    session.room = null;
    if (room) {
      const p = room.players.find((p) => p.id === session.id);
      if (room.match && p) {
        // Mid-match the seat stays and a bot plays it to the end (same player state).
        p.isBot = true;
        p.botTakeover = true;
        p.connected = false;
        p.reconnectDeadline = null;
      } else room.players = room.players.filter((p) => p.id !== session.id);
      if (room.hostId === session.id) room.hostId = "";
      this.reassignHost(room);
      if (!room.players.some((p) => !p.isBot && !p.botTakeover))
        this.deleteRoom(room.code, "empty");
      else this.broadcast(room);
    }
    session.send?.({ type: "STATE", lobby: null, serverNow: Date.now() });
  }
  // Back to the pre-match lobby after GAME_OVER (or after an aborted match): fresh players, same seats,
  // ready states reset, settings unlocked. Humans whose seat a bot had taken over are released.
  private resetToLobby(room: Lobby) {
    const gone = room.players.filter((p) => p.botTakeover);
    for (const p of gone)
      for (const s of this.sessions.values())
        if (s.id === p.id && s.room === room.code) {
          s.room = null;
          s.send?.({ type: "STATE", lobby: null, serverNow: Date.now() });
        }
    room.match = null;
    room.players = lobbyPlayers(room.players.filter((p) => !p.botTakeover));
    this.failures.delete(room.code);
    this.reassignHost(room);
    if (!room.players.some((p) => !p.isBot)) this.deleteRoom(room.code, "empty");
  }
  private lobbySummaries(query: string) {
    const text = query.trim().toLowerCase(),
      code = normalizeLobbyCode(query);
    return [...this.rooms.values()]
      .filter(
        (r) =>
          !r.match &&
          r.players.length < 4 &&
          (r.public || r.code === code) &&
          (!text ||
            r.code === code ||
            r.name.toLowerCase().includes(text) ||
            r.code.toLowerCase().includes(text)),
      )
      .map((r) => ({
        code: r.code,
        name: r.name,
        count: r.players.length,
        mapId: r.settings.mapId,
        public: r.public,
      }));
  }
  handle(session: Session, msg: ClientMessage) {
    if (msg.type === "PING") {
      session.send?.({ type: "PONG" });
      return;
    }
    if (msg.type === "LIST") {
      // A full code in the search box can reveal a private lobby, so it costs a code lookup.
      if (normalizeLobbyCode(msg.query) && !this.lookups.take(session.address))
        throw new PartyError("Too many lobby-code attempts. Wait a minute and try again.", "RATE_LIMITED");
      session.send?.({ type: "LOBBIES", lobbies: this.lobbySummaries(msg.query) });
      return;
    }
    if (msg.type === "LEAVE") {
      this.leave(session);
      return;
    }
    if (msg.type === "CREATE" || msg.type === "JOIN") {
      if (session.room) throw new PartyError("Leave your current lobby first.");
      let room: Lobby;
      if (msg.type === "CREATE") {
        if (this.rooms.size >= NETWORK_CONFIG.maxRooms)
          throw new PartyError("The server is full. Try again later.", "SERVER_FULL");
        if (!this.creates.take(session.address))
          throw new PartyError("You are creating lobbies too quickly. Wait a minute.", "RATE_LIMITED");
        // Six random digits from a CSPRNG (not sequential), collision-checked.
        let code: string;
        do {
          code = `PLUTO-${randomInt(100000, 1000000)}`;
        } while (this.rooms.has(code));
        room = {
          code,
          name: msg.name,
          public: msg.public,
          hostId: session.id,
          settings: { ...DEFAULT_SETTINGS },
          players: [],
          match: null,
        };
        this.rooms.set(code, room);
        log.info("lobby.created", { room: code, public: msg.public });
      } else {
        if (!this.lookups.take(session.address))
          throw new PartyError("Too many join attempts. Wait a minute and try again.", "RATE_LIMITED");
        const existing = this.rooms.get(msg.code);
        if (!existing)
          throw new PartyError("Lobby not found. Check the code and try again.", "LOBBY_NOT_FOUND");
        if (existing.match)
          throw new PartyError("That match has already started.", "MATCH_STARTED");
        if (existing.players.length >= 4)
          throw new PartyError("That lobby is full.", "LOBBY_FULL");
        room = existing;
      }
      const used = room.players.map((p) => p.avatarId);
      const avatar = [0, 1, 2, 3].find((id) => !used.includes(id))!;
      room.players.push(createPlayer(session.id, msg.playerName, avatar));
      session.room = room.code;
      this.broadcast(room);
      return;
    }
    const room = session.room ? this.rooms.get(session.room) : undefined;
    if (!room) throw new PartyError("Join a lobby first.", "LOBBY_NOT_FOUND");
    if (msg.type === "ACTION") {
      if (!room.match) throw new PartyError("The match has not started.");
      const match = room.match;
      try {
        room.match = applyAction(match, session.id, msg.action, room.settings, random, Date.now());
      } catch (error) {
        if (isExpectedError(error)) throw error;
        // A bug in a rule must not leak details or take the room down; the state is unchanged.
        this.logMatchError(room, match, error, `action ${msg.action.type}`);
        throw new PartyError("That action could not be completed.", "SERVER_ERROR");
      }
      room.players = room.match.players;
      this.afterMatchChange(room, match);
      this.broadcast(room);
      return;
    }
    if (msg.type === "RETURN_TO_LOBBY") {
      if (room.match?.phase !== "GAME_OVER")
        throw new PartyError("The match is still being played.");
      if (room.hostId !== session.id)
        throw new PartyError("Only the host can bring everyone back to the lobby.");
      this.resetToLobby(room);
      log.info("lobby.returned", { room: room.code });
      if (this.rooms.has(room.code)) this.broadcast(room);
      return;
    }
    if (room.match)
      throw new PartyError("Lobby settings are locked during a match.");
    if (msg.type === "READY") {
      const p = room.players.find((p) => p.id === session.id)!;
      p.ready = msg.ready;
      this.broadcast(room);
      return;
    }
    if (room.hostId !== session.id)
      throw new PartyError("Only the host can do that.");
    const addBot = () => {
      if (room.players.length >= 4)
        throw new PartyError("All four slots are occupied.");
      const avatar = [0, 1, 2, 3].find(
        (id) => !room.players.some((p) => p.avatarId === id),
      )!;
      const bot = createPlayer(
        randomUUID(),
        ["Mango", "Pebble", "Sprout", "Sunny"][avatar],
        avatar,
        true,
      );
      bot.difficulty = room.settings.difficulty;
      room.players.push(bot);
    };
    switch (msg.type) {
      case "ADD_BOT":
        addBot();
        break;
      case "REMOVE": {
        if (msg.playerId === session.id)
          throw new PartyError("Use Leave to exit your lobby.");
        if (!room.players.some((p) => p.id === msg.playerId))
          throw new PartyError("That player is not in this lobby.");
        room.players = room.players.filter((p) => p.id !== msg.playerId);
        const removed = [...this.sessions.values()].find(
          (s) => s.id === msg.playerId && s.room === room.code,
        );
        if (removed) {
          removed.room = null;
          removed.send?.({ type: "STATE", lobby: null, serverNow: Date.now() });
          removed.send?.({
            type: "ERROR",
            message: "The host removed you from this lobby.",
          });
        }
        break;
      }
      case "BOT_DIFFICULTY": {
        const bot = room.players.find((p) => p.id === msg.playerId && p.isBot);
        if (!bot) throw new PartyError("Bot not found.");
        bot.difficulty = msg.difficulty;
        break;
      }
      case "SETTINGS":
        room.settings = { ...msg.settings };
        room.players.forEach((p) => {
          p.ready = p.isBot;
        });
        break;
      case "START":
        if (room.players.some((p) => !p.isBot && (!p.ready || !p.connected)))
          throw new PartyError("Every human player must be connected and ready.");
        if (room.settings.fillBots) while (room.players.length < 4) addBot();
        if (room.players.length < 4)
          throw new PartyError("Four players are needed: add bots or turn on “fill with bots”.");
        room.match = createMatch(room.players, room.settings, random);
        room.players = room.match.players;
        log.info("match.start", {
          room: room.code,
          map: room.match.mapId,
          humans: room.players.filter((p) => !p.isBot).length,
        });
        break;
      default:
        throw new PartyError("Unsupported lobby action.");
    }
    this.broadcast(room);
  }
  private logMatchError(room: Lobby, match: Match, error: unknown, where: string) {
    const e = error instanceof Error ? error : new Error(String(error));
    log.error("match.error", {
      room: room.code,
      phase: match.phase,
      round: match.round,
      where,
      error: e.message,
    });
    logStack(e.stack);
  }
  // Counts a failed tick. A room that keeps failing is stopped and returned to its lobby; other rooms and
  // the process are unaffected.
  private failRoom(room: Lobby, error: unknown, where: string) {
    if (room.match) this.logMatchError(room, room.match, error, where);
    const count = (this.failures.get(room.code) ?? 0) + 1;
    this.failures.set(room.code, count);
    if (count < NETWORK_CONFIG.maxMatchFailures) return;
    log.error("match.aborted", { room: room.code, failures: count });
    for (const s of this.sessions.values())
      if (s.room === room.code)
        s.send?.({
          type: "ERROR",
          code: "MATCH_ERROR",
          message: "This match hit an unexpected problem and was stopped. You are back in the lobby.",
        });
    this.resetToLobby(room);
    if (this.rooms.has(room.code)) this.broadcast(room);
  }
  private afterMatchChange(room: Lobby, before: Match) {
    const after = room.match;
    if (after?.phase === "GAME_OVER" && before.phase !== "GAME_OVER")
      log.info("match.end", {
        room: room.code,
        winner: after.winner,
        round: after.round,
      });
  }
  // One bot decision for the active seat. A heuristic that throws or is rejected falls back to the
  // always-legal `safeBotAction`, so a bot can never stall or crash the match.
  private botStep(room: Lobby, state: Match, now: number): Match {
    const map = mapOf(state),
      id = activePlayer(state).id;
    let action: GameAction | null;
    try {
      action = this.decide(state, map, random, room.settings, now);
    } catch (error) {
      log.warn("bot.decision_failed", { room: room.code, phase: state.phase, error: (error as Error).message });
      action = safeBotAction(state, map);
    }
    if (!action) return state;
    try {
      return applyAction(state, id, action, room.settings, random, now);
    } catch (error) {
      log.warn("bot.action_rejected", { room: room.code, action: action.type, error: (error as Error).message });
      const fallback = safeBotAction(state, map);
      if (!fallback || sameAction(fallback, action)) throw error;
      return applyAction(state, id, fallback, room.settings, random, now);
    }
  }
  tick(now = Date.now()) {
    for (const session of this.sessions.values()) {
      if (session.disconnectedAt === null) continue;
      const away = now - session.disconnectedAt;
      const room = session.room ? this.rooms.get(session.room) : undefined;
      if (away > NETWORK_CONFIG.sessionTtlMs) {
        this.leave(session);
        this.sessions.delete(session.token);
        continue;
      }
      if (away <= NETWORK_CONFIG.reconnectGraceMs || !room) continue;
      if (room.match) {
        const p = room.players.find((p) => p.id === session.id);
        if (p && !p.isBot) {
          // Same player slot, same state: the bot simply starts making this seat's decisions.
          p.isBot = true;
          p.botTakeover = true;
          p.reconnectDeadline = null;
          log.info("seat.bot_takeover", { room: room.code, player: p.id, phase: room.match.phase });
          this.reassignHost(room);
          this.broadcast(room, now);
        }
      } else {
        log.info("lobby.seat_released", { room: room.code, player: session.id });
        this.leave(session);
      }
    }
    for (const room of this.rooms.values()) {
      // Rooms without a connected human are paused (nobody is watching); they resume on reconnect.
      if (!room.players.some((p) => p.connected && !p.isBot)) continue;
      if (!room.match || room.match.phase === "GAME_OVER") continue;
      const before = room.match;
      try {
        let next = advance(before, room.settings, random, now);
        if (next === before && activePlayer(next).isBot)
          next = this.botStep(room, next, now);
        this.failures.delete(room.code);
        if (next !== before) {
          room.match = next;
          room.players = next.players;
          this.afterMatchChange(room, before);
          this.broadcast(room, now);
        }
      } catch (error) {
        this.failRoom(room, error, "tick");
      }
    }
    // Defensive: a pre-game human seat with an expired deadline and no session behind it is a ghost.
    for (const room of this.rooms.values()) {
      if (room.match) continue;
      const ghosts = room.players.filter(
        (p) =>
          !p.isBot &&
          !p.connected &&
          (p.reconnectDeadline ?? Infinity) < now &&
          ![...this.sessions.values()].some((s) => s.id === p.id && s.room === room.code),
      );
      if (!ghosts.length) continue;
      room.players = room.players.filter((p) => !ghosts.includes(p));
      this.reassignHost(room);
      this.broadcast(room, now);
    }
    // Abandoned rooms (no session refers to them any more) are collected.
    for (const room of [...this.rooms.values()])
      if (![...this.sessions.values()].some((s) => s.room === room.code))
        this.deleteRoom(room.code, "abandoned");
    this.creates.prune(now);
    this.lookups.prune(now);
  }
  // Runs every ~100 ms. Only rooms in a timed minigame phase (main or duel) do work here: precise
  // intro/end timing, realtime simulation and minigame bot inputs, which need finer timing than the
  // 700 ms board tick. Realtime minigames set their own snapshot cadence (snapshotIntervalMs).
  fastTick(now = Date.now()) {
    for (const room of this.rooms.values()) {
      const match = room.match;
      if (
        !match ||
        !FAST_PHASES.has(match.phase) ||
        !room.players.some((p) => p.connected && !p.isBot)
      )
        continue;
      try {
        let next = advance(match, room.settings, random, now);
        const phaseChanged = next.phase !== match.phase;
        if (next !== match) this.dirty.add(room.code);
        const bots = stepMinigameBots(next, now, random);
        next = bots.match;
        room.match = next;
        room.players = next.players;
        if (bots.accepted > 0) this.dirty.add(room.code);
        const minInterval =
          (next.minigame &&
            minigameRegistry.get(next.minigame.minigameId).snapshotIntervalMs) ||
          MINIGAME_BROADCAST_MIN_MS;
        // Public views can change with time even when the simulation is unchanged (Echo Wall
        // flashes, rhythm notes). Honor their cadence throughout active play.
        const timedView = isMinigamePlayPhase(next.phase) && !!next.minigame &&
          !!minigameRegistry.get(next.minigame.minigameId).snapshotIntervalMs;
        const since = now - (this.lastBroadcast.get(room.code) ?? 0);
        if (phaseChanged) this.afterMatchChange(room, match);
        if (
          phaseChanged ||
          since >= MINIGAME_BROADCAST_MAX_MS ||
          ((timedView || this.dirty.has(room.code)) && since >= minInterval)
        )
          this.broadcast(room, now);
      } catch (error) {
        room.match = match;
        this.failRoom(room, error, "fastTick");
      }
    }
  }
}
