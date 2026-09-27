import { createClient } from "jsr:@supabase/supabase-js@2";
import { applyAction, createGame, shuffledDeck, viewFor, type Action, type GameState } from "../../../src/games/schafkopf/schafkopf.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type Room = { id: string; code: string; host_id: string; players: { id: string; name: string }[]; game: GameState | null; version: number };
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function snapshot(room: Room, userId: string) {
  const seat = room.players.findIndex(player => player.id === userId);
  if (seat < 0) throw new Error("Du sitzt nicht an diesem Tisch. Bitte über die Lobby beitreten.");
  return { code: room.code, hostId: room.host_id, version: room.version, players: room.players, game: room.game ? viewFor(room.game, seat) : null };
}
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const nameFor = (name: unknown) => typeof name === "string" ? name.trim().slice(0, 32) || "Spieler" : "Spieler";

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
    if (body.op === "create") {
      // Keep accidental repeated clicks from creating unlimited active rooms.
      const { count, error: countError } = await db.from("schafkopf_rooms").select("id", { count: "exact", head: true }).eq("host_id", user.id).gte("updated_at", new Date(Date.now() - 86_400_000).toISOString());
      if (countError) throw new Error("Tischspeicher nicht verfügbar.");
      if ((count ?? 0) >= 10) throw new Error("Du hast bereits zehn aktuelle Tische. Nutze einen bestehenden Tisch.");
      for (let attempt = 0; attempt < 5; attempt++) {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        const code = Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
        const { data, error } = await db.from("schafkopf_rooms").insert({ code, host_id: user.id, players: [{ id: user.id, name: nameFor(body.name) }] }).select().single();
        if (!error) return response(snapshot(data as Room, user.id));
        if (error.code !== "23505") throw new Error("Tisch konnte nicht gespeichert werden.");
      }
      throw new Error("Bitte erneut einen Tisch erstellen.");
    }
    const code = typeof body.code === "string" ? body.code.toUpperCase() : "";
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("Ungültiger Raumcode.");
    // Joining retries after a concurrent join; game actions use the client's version.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await db.from("schafkopf_rooms").select().eq("code", code).maybeSingle();
      if (error) throw new Error("Tisch konnte nicht geladen werden.");
      if (!data) return response({ error: "Tisch nicht gefunden." }, 404);
      const room = data as Room;
      const seat = room.players.findIndex(player => player.id === user.id);
      if (body.op === "join") {
        if (seat >= 0) return response(snapshot(room, user.id));
        if (room.game || room.players.length >= 4) throw new Error("Dieser Tisch ist voll oder das Spiel läuft bereits.");
        room.players.push({ id: user.id, name: nameFor(body.name) });
      } else {
        if (seat < 0) return response({ error: "Du sitzt nicht an diesem Tisch. Bitte über die Lobby beitreten." }, 403);
        if (body.op === "get") return response(snapshot(room, user.id));
        if (body.version !== room.version) return response({ error: "Der Tisch hat sich geändert. Bitte erneut versuchen." }, 409);
        if (body.op === "start") {
          if (room.host_id !== user.id || room.players.length !== 4 || room.game) throw new Error("Nur der Gastgeber kann einen vollen Tisch starten.");
          room.game = createGame(room.players.map(player => player.name), 3, shuffledDeck(random));
        } else if (body.op === "action") {
          if (!room.game || !body.action || typeof body.action.type !== "string") throw new Error("Ungültige Spielaktion.");
          if (body.action.type === "next" && room.host_id !== user.id) throw new Error("Nur der Gastgeber startet die nächste Runde.");
          room.game = applyAction(room.game, seat, body.action as Action, random);
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
      const { data: updated, error: updateError } = await db.from("schafkopf_rooms").update({ players: room.players, host_id: room.host_id, game: room.game, version: room.version + 1, updated_at: new Date().toISOString() }).eq("id", room.id).eq("version", room.version).select().maybeSingle();
      if (updateError) throw new Error("Änderung konnte nicht gespeichert werden.");
      if (updated) return response(body.op === "leave" ? null : snapshot(updated as Room, user.id));
      if (body.op !== "join") return response({ error: "Ein anderer Zug war schneller. Bitte erneut versuchen." }, 409);
    }
    return response({ error: "Tisch ist beschäftigt. Bitte erneut beitreten." }, 409);
  } catch (cause) {
    return response({ error: cause instanceof Error ? cause.message : "Anfrage fehlgeschlagen." }, 400);
  }
});
