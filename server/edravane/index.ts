// Legacy transport retained for regression tests. The game client now uses
// supabase/functions/edravane-match and does not require this server.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import {
  createCampaign,
  dispatchCommand,
  runAutomaticTurns,
  advanceTactical,
} from "../../src/games/MedievalKingdoms/edravane/simulation.ts";
import { initializeTurns } from "../../src/games/MedievalKingdoms/edravane/turns.ts";
import { establishEstates } from "../../src/games/MedievalKingdoms/edravane/estates.ts";
import { commandHouse } from "../../src/games/MedievalKingdoms/edravane/battle.ts";
import { NATIONS } from "../../src/games/MedievalKingdoms/edravane/world.ts";
import type {
  Campaign,
  Command,
} from "../../src/games/MedievalKingdoms/edravane/types.ts";
export type Slot = {
  nation: string;
  player: string | null;
  name: string;
  ready: boolean;
  connected: boolean;
  bot: boolean;
};
type Session = {
  id: string;
  token: string;
  room: string;
  nation: string;
  name: string;
  socket?: WebSocket;
  last?: number;
};
type Room = {
  code: string;
  host: string;
  slots: Slot[];
  state: Campaign | null;
  settings: {
    tickSeconds: number;
    maritimeHazard: number;
  };
  lastTick: number;
  sessions: Session[];
  touched: number;
};
export function startEdravaneServer(
  port = Number(process.env.EDRAVANE_PORT ?? 8788),
  host = process.env.EDRAVANE_HOST ?? "127.0.0.1",
  persistence = process.env.EDRAVANE_DATA_DIR,
) {
  const rooms = new Map<string, Room>();
  if (persistence) {
    mkdirSync(persistence, { recursive: true });
    try {
      const data = JSON.parse(
        readFileSync(`${persistence}/rooms.json`, "utf8"),
      ) as Room[];
      for (const room of data) {
        room.sessions.forEach((s) => (s.socket = undefined));
        room.slots.forEach((s) => {
          s.connected = false;
          s.bot = true;
        });
        if (room.state && !room.state.turns)
          initializeTurns(
            room.state,
            room.state.houses.find((h) => h.reasons.includes("Human commander"))
              ?.nation ?? NATIONS[0].id,
          );
        if (room.state && !room.state.estateRules)
          establishEstates(room.state, false);
        if (room.state)
          room.state.houses.forEach(
            (h) =>
              (h.reasons = h.reasons.filter((r) => r !== "Human commander")),
          );
        room.lastTick = Date.now();
        rooms.set(room.code, room);
      }
    } catch {
      /* First run has no snapshot. */
    }
  }
  const http = createServer((req, res) => {
    res.writeHead(req.url === "/health" ? 200 : 404, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ service: "edravane", status: "ok" }));
  });
  const sockets = new WebSocketServer({
    server: http,
    path: "/edravane-socket",
    maxPayload: 8192,
  });
  const origins = process.env.EDRAVANE_ORIGINS?.split(",").map((s) => s.trim());
  const send = (ws: WebSocket, m: unknown) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  };
  const publicRoom = (r: Room, viewer: Session) => ({
    code: r.code,
    host: r.sessions.find((s) => s.token === r.host)?.id,
    slots: r.slots.map((slot) => ({
      ...slot,
      player: r.sessions.find((s) => s.token === slot.player)?.id ?? null,
    })),
    state: r.state
      ? {
          ...r.state,
          battles: r.state.battles.map((b) =>
            b.rounds
              ? {
                  ...b,
                  rounds: {
                    ...b.rounds,
                    plans: Object.fromEntries(
                      Object.entries(b.rounds.plans).filter(([id]) => {
                        const army = r.state!.armies.find((a) => a.id === id);
                        return (
                          army &&
                          commandHouse(r.state!, army) === `${viewer.nation}-0`
                        );
                      }),
                    ),
                  },
                }
              : b,
          ),
        }
      : null,
    settings: r.settings,
  });
  const broadcast = (r: Room) => {
    for (const session of r.sessions)
      if (session.socket)
        send(session.socket, {
          type: "snapshot",
          room: publicRoom(r, session),
        });
  };
  const save = () => {
    if (!persistence) return;
    const data = [...rooms.values()].map((r) => ({
      ...r,
      sessions: r.sessions.map((s) => ({ ...s, socket: undefined })),
    }));
    writeFileSync(`${persistence}/rooms.tmp`, JSON.stringify(data));
    renameSync(`${persistence}/rooms.tmp`, `${persistence}/rooms.json`);
  };
  const setHuman = (r: Room, nation: string, human: boolean) => {
    const h = r.state?.houses.find((h) => h.id === `${nation}-0`);
    if (h) {
      h.reasons = h.reasons.filter((v) => v !== "Human commander");
      if (human) h.reasons.push("Human commander");
    }
  };
  sockets.on("connection", (ws, req) => {
    if (origins && !origins.includes(req.headers.origin ?? "")) {
      ws.close(1008, "Origin not allowed");
      return;
    }
    let session: Session | undefined,
      alive = true,
      count = 0,
      windowStart = Date.now();
    const heartbeat = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, 15000);
    ws.on("pong", () => (alive = true));
    const handshake = setTimeout(() => {
      if (!session) ws.close(1008, "Handshake required");
    }, 10000);
    ws.on("message", (raw) => {
      if (Date.now() - windowStart > 1000) {
        count = 0;
        windowStart = Date.now();
      }
      if (++count > 24) {
        ws.close(1008, "Rate limit");
        return;
      }
      try {
        const m = JSON.parse(raw.toString());
        if (!m || typeof m.type !== "string") throw Error("Invalid message");
        if (m.type === "create" || m.type === "join" || m.type === "resume") {
          if (session) throw Error("Already joined");
          let room: Room;
          if (m.type === "resume") {
            room = rooms.get(String(m.code))!;
            if (!room) throw Error("Room unavailable");
            session = room.sessions.find((s) => s.token === m.token);
            if (!session) throw Error("Invalid reconnect token");
            session.socket?.close(4001, "Session resumed elsewhere");
            session.socket = ws;
            if (!room.sessions.find((s) => s.token === room.host)?.socket)
              room.host = session.token;
            const slot = room.slots.find((s) => s.player === session!.token)!;
            slot.connected = true;
            slot.bot = false;
            setHuman(room, slot.nation, true);
          } else {
            if (!NATIONS.some((n) => n.id === m.nation))
              throw Error("Unknown nation");
            const name = String(m.name ?? "Ruler").slice(0, 30);
            if (m.type === "create") {
              if (rooms.size >= 64) throw Error("Server room limit reached");
              const code = randomBytes(4).toString("hex").toUpperCase();
              room = {
                code,
                host: "",
                slots: NATIONS.map((n) => ({
                  nation: n.id,
                  player: null,
                  name: "Bot",
                  ready: true,
                  connected: false,
                  bot: true,
                })),
                state: null,
                settings: { tickSeconds: 2, maritimeHazard: 0.025 },
                sessions: [],
                lastTick: Date.now(),
                touched: Date.now(),
              };
              rooms.set(code, room);
            } else {
              room = rooms.get(String(m.code).toUpperCase())!;
              if (!room) throw Error("Room unavailable");
              if (room.state)
                throw Error(
                  "Campaign started; reconnect with your saved token",
                );
            }
            const slot = room.slots.find((s) => s.nation === m.nation)!;
            if (slot.player) throw Error("Nation occupied");
            session = {
              id: randomBytes(8).toString("hex"),
              token: randomBytes(24).toString("hex"),
              room: room.code,
              nation: m.nation,
              name,
              socket: ws,
            };
            room.sessions.push(session);
            if (!room.host) room.host = session.token;
            Object.assign(slot, {
              player: session.token,
              name,
              ready: false,
              connected: true,
              bot: false,
            });
          }
          clearTimeout(handshake);
          send(ws, {
            type: "welcome",
            token: session.token,
            player: session.id,
            seq: session.last ?? 0,
            code: room.code,
            nation: session.nation,
          });
          broadcast(room);
          save();
          return;
        }
        if (!session) throw Error("Join a lobby first");
        const room = rooms.get(session.room)!;
        room.touched = Date.now();
        const slot = room.slots.find((s) => s.player === session!.token)!;
        if (m.type === "ready") {
          if (room.state) throw Error("Already started");
          slot.ready = !!m.ready;
        } else if (m.type === "select") {
          if (room.state) throw Error("Already started");
          const target = room.slots.find((s) => s.nation === m.nation);
          if (!target || target.player) throw Error("Nation occupied");
          Object.assign(slot, {
            player: null,
            name: "Bot",
            ready: true,
            connected: false,
            bot: true,
          });
          session.nation = target.nation;
          Object.assign(target, {
            player: session.token,
            name: session.name,
            ready: false,
            connected: true,
            bot: false,
          });
          send(ws, {
            type: "welcome",
            token: session.token,
            player: session.id,
            seq: session.last ?? 0,
            code: room.code,
            nation: session.nation,
          });
        } else if (m.type === "settings") {
          if (room.host !== session.token || room.state)
            throw Error("Host settings are locked");
          if (
            ![1, 2, 4].includes(m.tickSeconds) ||
            ![0, 0.025, 0.08].includes(m.maritimeHazard)
          )
            throw Error("Invalid settings");
          room.settings = {
            tickSeconds: m.tickSeconds,
            maritimeHazard: m.maritimeHazard,
          };
          room.slots.forEach((s) => {
            if (s.player) s.ready = false;
          });
        } else if (m.type === "start") {
          if (room.host !== session.token || room.state)
            throw Error("Only the lobby host can start");
          if (
            room.slots.some(
              (s) => s.player && !s.bot && (!s.ready || !s.connected),
            )
          )
            throw Error("Every human must be connected and ready");
          room.state = createCampaign(session.nation, "multi");
          Object.assign(room.state.config, room.settings);
          room.slots.forEach((s) => setHuman(room, s.nation, !s.bot));
          room.lastTick = Date.now();
        } else if (m.type === "command") {
          if (!room.state) throw Error("Campaign not started");
          if (
            !Number.isSafeInteger(m.seq) ||
            m.seq < 1 ||
            m.seq <= (session.last ?? 0)
          )
            throw Error("Duplicate or stale command");
          session.last = m.seq;
          room.state = dispatchCommand(
            room.state,
            { house: `${session.nation}-0`, host: room.host === session.token },
            m.command as Command,
          );
        } else throw Error("Unknown message");
        broadcast(room);
        save();
      } catch (error) {
        send(ws, {
          type: "error",
          message: error instanceof Error ? error.message : "Invalid command",
        });
      }
    });
    ws.on("close", () => {
      clearTimeout(handshake);
      clearInterval(heartbeat);
      if (!session || session.socket !== ws) return;
      const r = rooms.get(session.room);
      if (!r) return;
      session.socket = undefined;
      const slot = r.slots.find((s) => s.player === session!.token);
      if (slot) {
        slot.connected = false;
        slot.bot = true;
        slot.ready = true;
        setHuman(r, slot.nation, false);
        if (r.host === session.token) {
          const successor = r.sessions.find(
            (s) => s.socket && s.token !== session!.token,
          );
          if (successor) r.host = successor.token;
        }
      }
      if (r.state) {
        const b = r.state.battles[0];
        if (
          b &&
          b.phase === "encounter" &&
          b.armies.every((id) => {
            const a = r.state!.armies.find((a) => a.id === id)!;
            return !r
              .state!.houses.find((h) => h.id === commandHouse(r.state!, a))!
              .reasons.includes("Human commander");
          })
        )
          b.phase = "combat";
      }
      broadcast(r);
      save();
    });
  });
  let closed = false;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const r of rooms.values()) {
      if (!r.state) continue;
      const priorState = r.state;
      const resultCount = r.state.appliedResults.length;
      if (r.state.battles.length) {
        const b = r.state.battles[0];
        if (
          b.phase === "encounter" &&
          b.armies.every((id) => {
            const a = r.state!.armies.find((a) => a.id === id)!;
            return (
              b.stood.includes(id) ||
              !r
                .state!.houses.find((h) => h.id === commandHouse(r.state!, a))!
                .reasons.includes("Human commander")
            );
          })
        )
          b.phase = "combat";
        r.state = runAutomaticTurns(advanceTactical(r.state, 0.25));
        r.lastTick = now;
      } else {
        r.state = runAutomaticTurns(r.state);
      }
      if (r.state.appliedResults.length !== resultCount) save();
      if (r.state !== priorState) broadcast(r);
    }
  }, 250);
  const saveTimer = setInterval(save, 5000);
  http.listen(port, host);
  return {
    http,
    sockets,
    rooms,
    close: async () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      clearInterval(saveTimer);
      try {
        save();
      } catch (error) {
        console.error("Edravane snapshot save failed:", error);
      }
      for (const ws of sockets.clients) ws.terminate();
      await new Promise<void>((resolve) =>
        sockets.close(() => http.close(() => resolve())),
      );
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const app = startEdravaneServer();
  console.log(
    "Edravane authority listening at ws://127.0.0.1:8788/edravane-socket",
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void app.close().then(() => process.exit(0));
    });
}
