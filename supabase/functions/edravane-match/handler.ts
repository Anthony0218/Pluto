import {
  applyCouncilRequest,
  councilReply,
  makeCouncil,
  syncCouncil,
} from "../../../src/games/MedievalKingdoms/edravane/multiplayer.ts";
import type {
  CouncilRoom,
  CouncilPresence,
  CouncilRequest,
} from "../../../src/games/MedievalKingdoms/edravane/multiplayer.ts";
export type CouncilStore = {
  authenticate: (token: string) => Promise<string | null>;
  read: (code: string) => Promise<CouncilRoom | null>;
  presence: (code: string) => Promise<CouncilPresence[]>;
  write: (
    room: CouncilRoom,
    expected: number,
    actor: string,
  ) => Promise<boolean>;
  creations: (user: string, since: number) => Promise<number>;
  now?: () => number;
  code?: () => string;
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
export function councilHandler(store: CouncilStore) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return reply({ error: "POST required" }, 405);
    try {
      const authorization = req.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer "))
        return reply({ error: "Log in to host or join multiplayer." }, 401);
      const user = await store.authenticate(authorization.slice(7));
      if (!user)
        return reply({ error: "Session expired. Please log in again." }, 401);
      const raw = await req.text();
      if (raw.length > 8192) return reply({ error: "Request too large" }, 413);
      const body = JSON.parse(raw) as CouncilRequest;
      if (!body || Array.isArray(body) || typeof body.type !== "string")
        return reply({ error: "Invalid request" }, 400);
      const now = (store.now ?? Date.now)();
      if (body.type === "create") {
        if ((await store.creations(user, now - 3600000)) >= 6)
          return reply(
            { error: "Too many new councils. Reuse your existing room." },
            429,
          );
        for (let attempt = 0; attempt < 4; attempt++) {
          const code =
            store.code?.() ??
            Array.from(
              crypto.getRandomValues(new Uint8Array(8)),
              (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32],
            ).join("");
          const room = makeCouncil(code, user, body, now);
          if (await store.write(room, -1, user))
            return reply(councilReply(room, user));
        }
        return reply({ error: "Could not allocate a room code" }, 409);
      }
      const code = String(body.code ?? "")
        .trim()
        .toUpperCase();
      if (!/^[A-Z0-9]{8}$/.test(code))
        return reply({ error: "Enter the eight-character room code." }, 400);
      for (let attempt = 0; attempt < 8; attempt++) {
        const stored = await store.read(code);
        if (!stored) return reply({ error: "Council not found" }, 404);
        if (
          !["join"].includes(body.type) &&
          !stored.sessions.some((s) => s.id === user)
        )
          return reply({ error: "You are not seated in this council." }, 403);
        const room = structuredClone(stored);
        const before = JSON.stringify(room);
        syncCouncil(room, await store.presence(code), now, false);
        applyCouncilRequest(room, user, body, now);
        // Joining/reconnecting sets the new human before automatic turns run.
        syncCouncil(
          room,
          room.sessions.map((s) => ({
            user_id: s.id,
            active: s.connected,
            last_seen: new Date(now).toISOString(),
          })),
          now,
        );
        if (JSON.stringify(room) === before)
          return reply(councilReply(room, user));
        room.version = stored.version + 1;
        room.touched = now;
        if (await store.write(room, stored.version, user))
          return reply(councilReply(room, user));
        // A concurrent request won. Revalidate the intent against its persisted state.
      }
      return reply({ error: "Council is busy. Please try again." }, 409);
    } catch (cause) {
      return reply(
        {
          error:
            cause instanceof Error ? cause.message : "Council request failed",
        },
        400,
      );
    }
  };
}
