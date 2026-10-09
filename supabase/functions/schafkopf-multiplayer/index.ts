import { botConfig, type BotConfig } from "../../../src/games/schafkopf/botConfig.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { applyAction, chooseAiAction, collectSecondsFor, createGame, migrateGameState, MULTIPLAYER_LEGEN_DECISION_MILLISECONDS, MULTIPLAYER_TURN_MILLISECONDS, resolveLegenTimeout, shuffledDeck, viewFor, DEFAULT_GAME_RULES, type Action, type AiDifficulty, type GameRules, type GameState } from "../../../src/games/schafkopf/schafkopf.ts";
import { DEFAULT_ANNOUNCEMENT_SETTINGS, SIMPLE_ANNOUNCEMENT_SETTINGS, formatDeclarationAnnouncement } from "../../../src/games/schafkopf/announcements.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type Player = { id: string; name: string; avatar?: number; bot?: boolean };
type FormerPlayer = { id: string; name: string; total: number; round: number };
type Room = { id: string; code: string; host_id: string; title: string; ai_difficulty: AiDifficulty; collect_seconds: number; players: Player[]; former_players: FormerPlayer[]; pending_seats: number[]; game: GameState | null; version: number; updated_at: string };
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function snapshot(room: Room, userId: string) {
  const seat = room.players.findIndex(player => player.id === userId);
  if (seat < 0) throw new Error("Du sitzt nicht an diesem Tisch. Bitte über die Lobby beitreten.");
  return { code: room.code, hostId: room.host_id, title: room.title, aiDifficulty: room.ai_difficulty, collectSeconds: room.collect_seconds || collectSecondsFor(room.ai_difficulty), version: room.version, players: room.players, pendingSeats: room.pending_seats ?? [], game: room.game ? viewFor(room.game, seat) : null };
}
function summary(room: Room) {
  return { code: room.code, title: room.title, hostId: room.host_id, version: room.version, updatedAt: room.updated_at,
    players: room.players, formerPlayers: room.former_players ?? [], pendingSeats: room.pending_seats ?? [], totals: room.game?.totals ?? null, round: room.game?.round ?? null };
}
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const nameFor = (name: unknown) => typeof name === "string" ? name.trim().slice(0, 32) || "Spieler" : "Spieler";
const titleFor = (title: unknown) => typeof title === "string" ? title.trim().slice(0, 60) || "Spieltag" : "Spieltag";
function difficultyFor(value: unknown): AiDifficulty {
  if (value === "normal") return "amateur";
  if (value === undefined || value === null) return "beginner";
  if (value === "beginner" || value === "amateur" || value === "advanced" || value === "pro" || value === "legend") return value;
  throw new Error("Ungültige KI-Spielstärke.");
}
function avatarFor(value: unknown): number {
  if (value === undefined) return 2;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 5) throw new Error("Ungültiger Avatar.");
  return value as number;
}
function validRules(value: unknown): GameRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültige Tischregeln.");
  const input = value as Record<string, unknown>;
  const rules = { ...DEFAULT_GAME_RULES };
  for (const key of ["sauspiel", "farbwenz", "geier", "farbgeier", "hochzeit", "bettel", "ramsch", "legen", "showPoints", "showTrickPoints", "showPlayedTrumps"] as const) {
    if (typeof input[key] !== "boolean") throw new Error(`Ungültige Regel: ${key}.`);
    rules[key] = input[key];
  }
  if (input.eichelOberMuss !== undefined && typeof input.eichelOberMuss !== "boolean") throw new Error("Ungültige Eichel-Ober-Regel.");
  rules.eichelOberMuss = input.eichelOberMuss === true;
  for (const key of ["rufspielValue", "soloValue", "wenzValue", "ramschValue", "schneiderValue", "schwarzValue", "laufendeValue"] as const) {
    const amount = input[key] ?? rules[key];
    if (!Number.isInteger(amount) || (amount as number) < (["schneiderValue", "schwarzValue", "laufendeValue"].includes(key) ? 0 : 1) || (amount as number) > 999) throw new Error(`Ungültiger Preis: ${key}.`);
    rules[key] = amount as number;
  }
  for (const key of ["farbwenzValue", "geierValue", "farbgeierValue", "bettelValue"] as const) {
    if (input[key] === undefined) continue;
    const amount = input[key];
    if (!Number.isInteger(amount) || (amount as number) < 1 || (amount as number) > 999) throw new Error(`Ungültiger Preis: ${key}.`);
    rules[key] = amount as number;
  }
  if (input.spritzen !== "nie" && input.spritzen !== "vor-ausspiel" && input.spritzen !== "jederzeit") throw new Error("Ungültige Spritzregel.");
  rules.spritzen = input.spritzen;
  for (const key of ["davonlaufen", "toutAbbrechen", "laufendeAktiv", "klopferMussSpiel"] as const) {
    if (input[key] !== undefined) { if (typeof input[key] !== "boolean") throw new Error(`Ungültige Regel: ${key}.`); rules[key] = input[key]; }
  }
  for (const [key,min,max] of [["rufsauAbwerfenAbStich",1,8],["laufendeAbFarbspiel",1,14],["laufendeAbWenzGeier",1,4],["hotseatKlopfSekunden",5,180],["multiplayerKlopfSekunden",5,180]] as const) {
    if (input[key] !== undefined) { if (!Number.isInteger(input[key]) || Number(input[key]) < min || Number(input[key]) > max) throw new Error(`Ungültige Regel: ${key}.`); rules[key] = Number(input[key]); }
  }
  if (input.bot !== undefined) {
    if (!input.bot || typeof input.bot !== "object" || Array.isArray(input.bot)) throw new Error("Ungültige Bot-Einstellungen.");
    rules.bot = botConfig(input.bot as Partial<BotConfig>);
  }
  return rules;
}
function hasTimedTurn(game: GameState) {
  return ["intent", "auction", "declare", "kontra", "re", "play"].includes(game.phase);
}
/**
 * Online clocks are shared state so every seat sees the same countdown. A
 * reached turn clock deliberately does not choose a card or an announcement:
 * for now it only signals that the player has used their allotted time.
 */
function scheduleMultiplayerTimers(game: GameState, resetTurn = true, resetLegen = false) {
  if (game.phase === "legen") {
    if (resetLegen || !Number.isFinite(game.legenDeadline)) game.legenDeadline = Date.now() + (game.rules.multiplayerKlopfSekunden ?? MULTIPLAYER_LEGEN_DECISION_MILLISECONDS / 1000) * 1000;
    game.turnDeadline = null;
    return;
  }
  game.legenDeadline = null;
  if (!hasTimedTurn(game)) { game.turnDeadline = null; return; }
  if (resetTurn || !Number.isFinite(game.turnDeadline)) game.turnDeadline = Date.now() + MULTIPLAYER_TURN_MILLISECONDS;
}
function fillBots(players: Player[]): Player[] {
  const names = ["KI Sepp", "KI Resi", "KI Franz"];
  return [...players, ...Array.from({ length: 4 - players.length }, (_, index) => ({ id: `bot:${crypto.randomUUID()}`, name: names[index], bot: true }))];
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "POST erforderlich." }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return response({ error: "Bitte anmelden." }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return response({ error: "Sitzung abgelaufen. Bitte erneut anmelden." }, 401);
    const raw = await req.text();
    if (raw.length > 4096) return response({ error: "Anfrage zu groß." }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object") throw new Error("Ungültige Anfrage.");
    if (body.op === "list") {
      const columns = "id,code,title,host_id,players,former_players,pending_seats,game,version,updated_at,ai_difficulty,collect_seconds";
      const { data, error } = await db.from("schafkopf_rooms").select(columns).contains("players", [{ id: user.id }]).order("updated_at", { ascending: false }).limit(100);
      if (error) throw new Error("Spieltage konnten nicht geladen werden.");
      const { data: former, error: formerError } = await db.from("schafkopf_rooms").select(columns).contains("former_players", [{ id: user.id }]).order("updated_at", { ascending: false }).limit(100);
      if (formerError) throw new Error("Spieltage konnten nicht geladen werden.");
      const rooms = [...new Map([...(data as Room[]), ...(former as Room[])].map(room => [room.id, room])).values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 100);
      const { data: hidden, error: hiddenError } = await db.from("schafkopf_room_hidden").select("room_id").eq("user_id", user.id);
      if (hiddenError) throw new Error("Spieltage konnten nicht geladen werden.");
      const hiddenIds = new Set((hidden ?? []).map(row => row.room_id));
      return response(rooms.filter(room => !hiddenIds.has(room.id)).map(summary));
    }
    if (body.op === "create") {
      const { count, error: countError } = await db.from("schafkopf_rooms").select("id", { count: "exact", head: true }).eq("host_id", user.id).gte("updated_at", new Date(Date.now() - 86_400_000).toISOString());
      if (countError) throw new Error("Tischspeicher nicht verfügbar.");
      if ((count ?? 0) >= 10) throw new Error("Du hast bereits zehn aktuelle Tische. Nutze einen bestehenden Tisch.");
      for (let attempt = 0; attempt < 5; attempt++) {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const code = Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
        const { data, error } = await db.from("schafkopf_rooms").insert({ code, host_id: user.id, title: titleFor(body.title), ai_difficulty: difficultyFor(body.aiDifficulty), players: [{ id: user.id, name: nameFor(body.name), avatar: avatarFor(body.avatar) }], former_players: [], pending_seats: [] }).select().single();
        if (!error) return response(snapshot(data as Room, user.id));
        if (error.code !== "23505") throw new Error("Tisch konnte nicht gespeichert werden.");
      }
      throw new Error("Bitte erneut einen Tisch erstellen.");
    }
    const code = typeof body.code === "string" ? body.code.toUpperCase() : "";
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("Ungültiger Raumcode.");
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await db.from("schafkopf_rooms").select().eq("code", code).maybeSingle();
      if (error) throw new Error("Tisch konnte nicht geladen werden.");
      if (!data) return response({ error: "Tisch nicht gefunden." }, 404);
      const room = data as Room;
      if (room.game) room.game = migrateGameState(room.game);
      room.former_players ??= [];
      room.pending_seats ??= [];
      const seat = room.players.findIndex(player => player.id === user.id);
      if (body.op === "join") {
        if (seat >= 0) return response(snapshot(room, user.id));
        if (!room.game) {
          if (room.players.length >= 4) throw new Error("Dieser Tisch ist voll.");
          room.players.push({ id: user.id, name: nameFor(body.name), avatar: avatarFor(body.avatar) });
        } else {
          if (room.game.phase !== "finished" && room.game.phase !== "redeal") throw new Error("Beitreten ist zwischen zwei Spielen möglich.");
          const openSeat = room.players.findIndex((player, index) => index > 0 && player.id.startsWith("bot:"));
          if (openSeat < 0) throw new Error("An diesem Tisch ist kein KI-Platz frei.");
          if (!room.pending_seats.includes(openSeat)) room.former_players.push({ id: room.players[openSeat].id, name: room.players[openSeat].name, total: room.game.totals[openSeat], round: room.game.round });
          room.players[openSeat] = { id: user.id, name: nameFor(body.name), avatar: avatarFor(body.avatar) };
          if (!room.pending_seats.includes(openSeat)) room.pending_seats.push(openSeat);
        }
      } else {
        const formerPlayer = room.former_players.some(player => player.id === user.id);
        if (seat < 0 && !(body.op === "delete" && formerPlayer)) return response({ error: formerPlayer ? "Du wurdest zwischen den Runden ersetzt. Dein Spielstand bleibt unter Spieltage gespeichert." : "Du sitzt nicht an diesem Tisch. Bitte über die Lobby beitreten." }, 403);
        if (body.op === "get") {
          if (room.game?.phase === "legen") {
            if (!Number.isFinite(room.game.legenDeadline)) room.game.legenDeadline = Date.now() + (room.game.rules.multiplayerKlopfSekunden ?? MULTIPLAYER_LEGEN_DECISION_MILLISECONDS / 1000) * 1000;
            if (room.game.legenDeadline && Date.now() >= room.game.legenDeadline) {
              room.game = resolveLegenTimeout(room.game);
              scheduleMultiplayerTimers(room.game);
            }
            else if (Date.now() - new Date(room.updated_at).getTime() >= 700) {
              // Bots decide independently as well; humans do not have to wait
              // for them or for the player left of the dealer.
              for (let botSeat = 0; botSeat < 4; botSeat++) {
                if (!room.players[botSeat]?.bot || room.game.legenDecisions[botSeat] !== null) continue;
                room.game = applyAction(room.game, botSeat, chooseAiAction(viewFor(room.game, botSeat), room.ai_difficulty, random), random);
              }
            }
          }
          if (room.game) scheduleMultiplayerTimers(room.game, false);
          const botSeat = room.game?.turn ?? -1;
          const isBotTurn = room.game?.phase !== "legen" && botSeat >= 0 && room.players[botSeat]?.bot && room.game?.phase !== "finished" && room.game?.phase !== "redeal";
          const delay = room.game?.phase === "trick" ? (room.collect_seconds || collectSecondsFor(room.ai_difficulty)) * 1000 : 700;
          if (!isBotTurn || Date.now() - new Date(room.updated_at).getTime() < delay) return response(snapshot(room, user.id));
          const aiAction = chooseAiAction(viewFor(room.game!, botSeat), room.ai_difficulty, random);
          room.game = applyAction(room.game!, botSeat, aiAction.type === "declare" ? { ...aiAction, phrase: formatDeclarationAnnouncement(aiAction.contract, room.ai_difficulty === "beginner" || room.ai_difficulty === "amateur" ? SIMPLE_ANNOUNCEMENT_SETTINGS : DEFAULT_ANNOUNCEMENT_SETTINGS, random) } : aiAction, random);
          scheduleMultiplayerTimers(room.game);
        } else {
          if (body.op !== "delete" && body.version !== room.version) return response({ error: "Der Tisch hat sich geändert. Bitte erneut versuchen." }, 409);
          if (body.op === "start") {
            if (room.host_id !== user.id || room.game) throw new Error("Nur der Gastgeber kann diesen Tisch starten.");
            room.title = titleFor(body.title);
            room.ai_difficulty = difficultyFor(body.aiDifficulty);
            room.players = fillBots(room.players);
            room.game = createGame(room.players.map(player => player.name), 3, shuffledDeck(random), undefined, 1, validRules(body.rules ?? DEFAULT_GAME_RULES));
            scheduleMultiplayerTimers(room.game, true, true);
          } else if (body.op === "configure") {
            if (room.host_id !== user.id || room.game) throw new Error("Nur der Gastgeber kann den Wartetisch einstellen.");
            room.title = titleFor(body.title);
            room.ai_difficulty = difficultyFor(body.aiDifficulty);
          } else if (body.op === "avatar") {
            if (body.avatar === undefined) throw new Error("Avatar fehlt.");
            room.players[seat].avatar = avatarFor(body.avatar);
            if (body.name !== undefined) {
              const previous = room.players[seat].name;
              const name = nameFor(body.name);
              room.players[seat].name = name;
              if (room.game) {
                room.game.names[seat] = name;
                room.game.announcements = room.game.announcements.map(text => text.startsWith(`${previous}: `) ? `${name}: ${text.slice(previous.length + 2)}` : text);
              }
            }
          } else if (body.op === "difficulty") {
            if (room.host_id !== user.id) throw new Error("Nur der Gastgeber ändert die Bot-Stufe.");
            room.ai_difficulty = difficultyFor(body.aiDifficulty);
          } else if (body.op === "timing") {
            if (room.host_id !== user.id || !room.game) throw new Error("Nur der Gastgeber ändert die Einsammelzeit.");
            if (!Number.isInteger(body.collectSeconds) || body.collectSeconds < 1 || body.collectSeconds > 10) throw new Error("Ungültige Einsammelzeit.");
            room.collect_seconds = body.collectSeconds;
          } else if (body.op === "rules") {
            if (room.host_id !== user.id || !room.game) throw new Error("Nur der Gastgeber kann die Tischregeln ändern.");
            room.game.rules = validRules(body.rules);
            room.game.revision++;
          } else if (body.op === "replace") {
            const target = body.seat;
            if (!room.game || !Number.isInteger(target) || target < 0 || target > 3 || typeof body.bot !== "boolean") throw new Error("Ungültiger KI-Ersatz.");
            const player = room.players[target];
            if (!player || player.id.startsWith("bot:")) throw new Error("Dieser KI-Platz hat kein menschliches Konto.");
            if (room.host_id !== user.id && !(player.id === user.id && body.bot === false)) throw new Error("Nur der Gastgeber kann KI-Ersatz einschalten.");
            player.bot = body.bot;
          } else if (body.op === "vacate") {
            const target = body.seat;
            if (room.host_id !== user.id) throw new Error("Nur der Gastgeber kann einen Platz freigeben.");
            if (!room.game || (room.game.phase !== "finished" && room.game.phase !== "redeal")) throw new Error("Plätze können nur zwischen zwei Spielen gewechselt werden.");
            if (!Number.isInteger(target) || target < 1 || target > 3) throw new Error("Ungültiger Platz.");
            const player = room.players[target];
            if (!player || player.id.startsWith("bot:")) throw new Error("Auf diesem Platz sitzt bereits eine KI.");
            room.former_players.push({ id: player.id, name: player.name, total: room.game.totals[target], round: room.game.round });
            room.players[target] = { id: `bot:${crypto.randomUUID()}`, name: `KI ${["Sepp", "Resi", "Franz"][target - 1]}`, bot: true };
            if (!room.pending_seats.includes(target)) room.pending_seats.push(target);
          } else if (body.op === "action") {
            if (!room.game || !body.action || typeof body.action.type !== "string") throw new Error("Ungültige Spielaktion.");
            if (room.players[seat]?.bot) throw new Error("Die KI spielt gerade deinen Platz. Übernimm ihn zuerst wieder.");
            if (body.action.type === "next" && room.host_id !== user.id) throw new Error("Nur der Gastgeber startet die nächste Runde.");
            room.game = applyAction(room.game, seat, body.action as Action, random);
            scheduleMultiplayerTimers(room.game, true, body.action.type === "next");
            if (body.action.type === "next") {
              room.game.names = room.players.map(player => player.name);
              for (const target of room.pending_seats) room.game.totals[target] = 0;
              room.pending_seats = [];
            }
          } else if (body.op === "delete") {
            if (room.host_id === user.id) {
              const { data: removed, error: removeError } = await db.from("schafkopf_rooms").delete().eq("id", room.id).eq("host_id", user.id).select("id");
              if (removeError) throw new Error("Spieltag konnte nicht gelöscht werden.");
              if (!removed?.length) return response({ error: "Der Tisch hat sich geändert. Bitte erneut versuchen." }, 409);
            } else {
              const { error: hideError } = await db.from("schafkopf_room_hidden").upsert({ room_id: room.id, user_id: user.id });
              if (hideError) throw new Error("Spieltag konnte nicht entfernt werden.");
            }
            return response(null);
          } else if (body.op === "leave") {
            if (room.game) throw new Error("Ein laufender Tisch bleibt für die Wiederverbindung reserviert.");
            room.players.splice(seat, 1);
            if (room.players.length === 0) {
              const { data: removed, error: removeError } = await db.from("schafkopf_rooms").delete().eq("id", room.id).eq("version", room.version).select("id");
              if (removeError) throw new Error("Tisch konnte nicht verlassen werden.");
              if (!removed?.length) return response({ error: "Der Tisch hat sich geändert. Bitte erneut versuchen." }, 409);
              return response(null);
            }
            if (room.host_id === user.id) room.host_id = room.players[0].id;
          } else throw new Error("Unbekannte Aktion.");
        }
      }
      const { data: updated, error: updateError } = await db.from("schafkopf_rooms").update({ players: room.players, former_players: room.former_players, pending_seats: room.pending_seats, host_id: room.host_id, title: room.title, ai_difficulty: room.ai_difficulty, collect_seconds: room.collect_seconds ?? 0, game: room.game, version: room.version + 1, updated_at: new Date().toISOString() }).eq("id", room.id).eq("version", room.version).select().maybeSingle();
      if (updateError) throw new Error("Änderung konnte nicht gespeichert werden.");
      if (updated) return response(body.op === "leave" ? null : snapshot(updated as Room, user.id));
      if (body.op !== "join" && body.op !== "get") return response({ error: "Ein anderer Zug war schneller. Bitte erneut versuchen." }, 409);
    }
    return response({ error: "Tisch ist beschäftigt. Bitte erneut beitreten." }, 409);
  } catch (cause) {
    return response({ error: cause instanceof Error ? cause.message : "Anfrage fehlgeschlagen." }, 400);
  }
});
