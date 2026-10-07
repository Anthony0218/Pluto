import { createClient } from "jsr:@supabase/supabase-js@2";
import { councilHandler } from "./handler.ts";
import type {
  CouncilRoom,
  CouncilPresence,
} from "../../../src/games/MedievalKingdoms/edravane/multiplayer.ts";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(
  councilHandler({
    authenticate: async (token) => {
      const {
        data: { user },
        error,
      } = await db.auth.getUser(token);
      return error ? null : (user?.id ?? null);
    },
    read: async (code) => {
      const { data, error } = await db
        .from("edravane_rooms")
        .select("data")
        .eq("code", code)
        .maybeSingle();
      if (error)
        throw Error(
          "Could not load the council. Check the Edravane Supabase deployment.",
        );
      return (data?.data as CouncilRoom) ?? null;
    },
    presence: async (code) => {
      const { data, error } = await db
        .from("edravane_members")
        .select("user_id,last_seen,active")
        .eq("code", code);
      if (error) throw Error("Could not read council membership");
      return data as CouncilPresence[];
    },
    write: async (room, expected, actor) => {
      const { data, error } = await db.rpc("edravane_store_room", {
        p_code: room.code,
        p_expected: expected,
        p_room: room,
        p_actor: actor,
      });
      if (error) throw Error("Could not save the council");
      return data === true;
    },
    creations: async (user, since) => {
      const { count, error } = await db
        .from("edravane_rooms")
        .select("code", { count: "exact", head: true })
        .eq("creator_id", user)
        .gte("created_at", new Date(since).toISOString());
      if (error) throw Error("Edravane Supabase deployment is unavailable");
      return count ?? 0;
    },
  }),
);
