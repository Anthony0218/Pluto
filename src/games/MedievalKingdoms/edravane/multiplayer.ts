import {
  createCampaign,
  dispatchCommand,
  runAutomaticTurns,
  advanceTactical,
} from "./simulation.ts";
import { commandHouse } from "./battle.ts";
import { NATIONS } from "./world.ts";
import type { Campaign, Command } from "./types.ts";

export const PRESENCE_MS = 90000;
export type CouncilSlot = {
  nation: string;
  player: string | null;
  name: string;
  ready: boolean;
  connected: boolean;
  bot: boolean;
};
export type CouncilMember = {
  id: string;
  nation: string;
  name: string;
  connected: boolean;
  last: number;
};
export type CouncilRoom = {
  code: string;
  host: string;
  slots: CouncilSlot[];
  state: Campaign | null;
  settings: { tickSeconds: number; maritimeHazard: number };
  sessions: CouncilMember[];
  version: number;
  createdAt: number;
  touched: number;
};
export type CouncilView = Omit<
  CouncilRoom,
  "sessions" | "createdAt" | "touched"
>;
export type CouncilReply = {
  room: CouncilView;
  player: string;
  nation: string;
  seq: number;
};
export type CouncilPresence = {
  user_id: string;
  last_seen: string;
  active: boolean;
};
export type CouncilRequest = {
  type: string;
  code?: string;
  nation?: string;
  name?: string;
  ready?: boolean;
  tickSeconds?: number;
  maritimeHazard?: number;
  seq?: number;
  command?: Command;
};

function nation(value: unknown) {
  if (!NATIONS.some((n) => n.id === value)) throw Error("Unknown crown");
  return String(value);
}
function name(value: unknown) {
  return (
    String(value || "Ruler")
      .trim()
      .slice(0, 30) || "Ruler"
  );
}
function human(room: CouncilRoom, crown: string, value: boolean) {
  const h = room.state?.houses.find((h) => h.id === `${crown}-0`);
  if (h) {
    h.reasons = h.reasons.filter((r) => r !== "Human commander");
    if (value) h.reasons.push("Human commander");
  }
}
function disconnected(room: CouncilRoom, member: CouncilMember) {
  member.connected = false;
  const slot = room.slots.find((s) => s.player === member.id)!;
  Object.assign(slot, { connected: false, bot: true, ready: true });
  human(room, member.nation, false);
}
function reconnect(room: CouncilRoom, member: CouncilMember) {
  member.connected = true;
  Object.assign(room.slots.find((s) => s.player === member.id)!, {
    connected: true,
    bot: false,
  });
  human(room, member.nation, true);
  if (!room.sessions.some((s) => s.id === room.host && s.connected))
    room.host = member.id;
}
export function makeCouncil(
  code: string,
  user: string,
  request: CouncilRequest,
  now: number,
): CouncilRoom {
  const crown = nation(request.nation),
    displayName = name(request.name);
  const room: CouncilRoom = {
    code,
    host: user,
    slots: NATIONS.map((n) => ({
      nation: n.id,
      player: null,
      name: "Bot",
      ready: true,
      connected: false,
      bot: true,
    })),
    state: null,
    settings: { tickSeconds: 4, maritimeHazard: 0.025 },
    sessions: [
      { id: user, nation: crown, name: displayName, connected: true, last: 0 },
    ],
    version: 0,
    createdAt: now,
    touched: now,
  };
  Object.assign(room.slots.find((s) => s.nation === crown)!, {
    player: user,
    name: displayName,
    ready: false,
    connected: true,
    bot: false,
  });
  return room;
}
/** Only server-verified database leases can trigger a disconnect. Realtime presence is not authority. */
export function syncCouncil(
  room: CouncilRoom,
  presence: CouncilPresence[],
  now: number,
  runBots = true,
) {
  for (const member of room.sessions) {
    const lease = presence.find((p) => p.user_id === member.id);
    if (
      member.connected &&
      (!lease?.active || now - Date.parse(lease.last_seen) > PRESENCE_MS)
    )
      disconnected(room, member);
  }
  if (!room.sessions.some((s) => s.id === room.host && s.connected)) {
    const successor = room.sessions.find((s) => s.connected);
    if (successor) room.host = successor.id;
  }
  if (!runBots || !room.state || !room.sessions.some((s) => s.connected))
    return;
  const battle = room.state.battles[0];
  if (
    battle?.phase === "encounter" &&
    battle.armies.every((id) => {
      const army = room.state!.armies.find((a) => a.id === id)!;
      return (
        battle.stood.includes(id) ||
        !room
          .state!.houses.find((h) => h.id === commandHouse(room.state!, army))!
          .reasons.includes("Human commander")
      );
    })
  )
    battle.phase = "combat";
  // New rounds never advance on elapsed time. This only fills bot orders or drains bot campaign turns.
  if (battle?.rounds) room.state = advanceTactical(room.state);
  room.state = runAutomaticTurns(room.state);
}
export function applyCouncilRequest(
  room: CouncilRoom,
  user: string,
  request: CouncilRequest,
  now: number,
) {
  let member = room.sessions.find((s) => s.id === user);
  if (request.type === "join") {
    if (member) {
      reconnect(room, member);
      return;
    }
    if (room.state)
      throw Error(
        "Campaign already started. Only seated players can reconnect.",
      );
    const crown = nation(request.nation),
      slot = room.slots.find((s) => s.nation === crown)!;
    if (slot.player) throw Error("Crown occupied");
    member = {
      id: user,
      nation: crown,
      name: name(request.name),
      connected: true,
      last: 0,
    };
    room.sessions.push(member);
    Object.assign(slot, {
      player: user,
      name: member.name,
      connected: true,
      bot: false,
      ready: false,
    });
    return;
  }
  if (!member) throw Error("Join this council first");
  if (request.type === "resume") {
    reconnect(room, member);
    return;
  }
  if (request.type === "snapshot") return;
  if (!member.connected)
    throw Error("Disconnected. Reconnect to regain command.");
  const slot = room.slots.find((s) => s.player === user)!;
  if (request.type === "leave") {
    disconnected(room, member);
    return;
  }
  if (request.type === "ready") {
    if (room.state) throw Error("Campaign already started");
    if (typeof request.ready !== "boolean") throw Error("Invalid readiness");
    slot.ready = request.ready;
  } else if (request.type === "select") {
    if (room.state) throw Error("Campaign already started");
    const target = room.slots.find((s) => s.nation === request.nation);
    if (!target || target.player) throw Error("Crown occupied");
    Object.assign(slot, {
      player: null,
      name: "Bot",
      ready: true,
      connected: false,
      bot: true,
    });
    member.nation = target.nation;
    Object.assign(target, {
      player: user,
      name: member.name,
      ready: false,
      connected: true,
      bot: false,
    });
  } else if (request.type === "settings") {
    if (room.host !== user || room.state)
      throw Error("Only the lobby host can change settings");
    if (
      !Number.isFinite(request.tickSeconds) ||
      request.tickSeconds! < 1 ||
      request.tickSeconds! > 30 ||
      !Number.isFinite(request.maritimeHazard) ||
      request.maritimeHazard! < 0 ||
      request.maritimeHazard! > 0.2
    )
      throw Error("Invalid settings");
    room.settings = {
      tickSeconds: request.tickSeconds!,
      maritimeHazard: request.maritimeHazard!,
    };
    room.slots.forEach((s) => {
      if (s.player) s.ready = false;
    });
  } else if (request.type === "start") {
    if (room.host !== user || room.state)
      throw Error("Only the lobby host can start");
    if (
      room.slots.some((s) => s.player && !s.bot && (!s.ready || !s.connected))
    )
      throw Error(
        "Every human, including the host, must be connected and ready",
      );
    room.state = createCampaign(member.nation, "multi");
    Object.assign(room.state.config, room.settings);
    room.slots.forEach((s) => human(room, s.nation, !s.bot));
  } else if (request.type === "command") {
    if (!room.state) throw Error("Campaign not started");
    if (
      !Number.isSafeInteger(request.seq) ||
      request.seq! < 1 ||
      request.seq! <= member.last
    )
      throw Error("Duplicate or stale command");
    if (!request.command || typeof request.command.type !== "string")
      throw Error("Invalid command");
    room.state = dispatchCommand(
      room.state,
      { house: `${member.nation}-0`, host: room.host === user },
      request.command,
    );
    member.last = request.seq!;
  } else throw Error("Unknown council action");
  room.touched = now;
}
export function councilReply(room: CouncilRoom, user: string): CouncilReply {
  const member = room.sessions.find((s) => s.id === user);
  if (!member) throw Error("Join this council first");
  const view: CouncilView = structuredClone({
    code: room.code, host: room.host, slots: room.slots, state: room.state,
    settings: room.settings, version: room.version,
  });
  if (view.state)
    for (const b of view.state.battles)
      if (b.rounds) {
        b.rounds.plans = Object.fromEntries(
          Object.entries(b.rounds.plans).filter(([id]) => {
            const army = view.state!.armies.find((a) => a.id === id);
            return (
              army && commandHouse(view.state!, army) === `${member.nation}-0`
            );
          }),
        );
      }
  return { room: view, player: user, nation: member.nation, seq: member.last };
}
