import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { shareRoomWithClan } from "./clanShare";
import { currentRoomInvite } from "./inviteRoute";
const KEY = "pluto-pending-created-invite";
type Pending = { userId: string; friendId?: string; clanId?: string; route: string; startedAt: number; code?: string; inviteId: string };
export function prepareCreatedGameInvite(pending: Omit<Pending, "startedAt" | "inviteId">) {
  sessionStorage.setItem(KEY, JSON.stringify({ ...pending, inviteId: crypto.randomUUID(), startedAt: Date.now() }));
}
function readPending(): Pending | null {
  try { const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null"); return value && Date.now() - value.startedAt < 10 * 60_000 ? value : null; } catch { return null; }
}
export function recordCreatedGameInvite(destination: string) {
  const [path, search] = destination.split("?");
  const room = currentRoomInvite(path, search);
  if (room) recordCreatedGameInviteCode(room.code, room.lobbyRoute);
  return destination;
}
export function recordCreatedGameInviteCode(code: string, route: string) {
  const pending = readPending();
  if (pending && pending.route === route) sessionStorage.setItem(KEY, JSON.stringify({ ...pending, code }));
}
export function useCreatedGameInvite(room: { lobbyRoute: string; code: string } | null) {
  const { user } = useAuth();
  const sending = useRef(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const route = room?.lobbyRoute, code = room?.code;
  useEffect(() => {
    const pending = readPending();
    if (!user || !route || !code || !pending || pending.code !== code || pending.userId !== user.id || pending.route !== route || sending.current) return;
    sending.current = true;
    void (async () => {
      try {
        if (pending.clanId) {
          const { error } = await shareRoomWithClan(pending.clanId, code, route);
          if (error) throw error;
          sessionStorage.removeItem(KEY); setFailed(false); setStatus("Room created and clan invited.");
        } else {
          const { error } = await supabase.from("friend_messages").insert({ id: pending.inviteId, sender_id: user.id, receiver_id: pending.friendId, message_type: "game_code", game: route.startsWith("/games/watten/") ? "watten" : "chess", game_code: code, game_route: route });
          if (error && error.code !== "23505") throw error;
          sessionStorage.removeItem(KEY); setFailed(false); setStatus("Room created and friend invited.");
        }
      } catch {
        setFailed(true); setStatus(pending.clanId ? "Room created. The clan invite could not be sent. Retry or share the room code." : "Room created. The invite could not be sent. Retry or share the room code.");
      } finally { sending.current = false; }
    })();
  }, [user, route, code, attempt]);
  useEffect(() => {
    if (!status || failed) return;
    const timer = window.setTimeout(() => setStatus(""), 6000);
    return () => window.clearTimeout(timer);
  }, [status, failed]);
  return { status, failed, retry: () => { setFailed(false); setAttempt(value => value + 1); } };
}
export default function GameInviteDelivery() {
  const location = useLocation();
  const delivery = useCreatedGameInvite(currentRoomInvite(location.pathname, location.search));
  if (!delivery.status) return null;
  return <div role={delivery.failed ? "alert" : "status"} className="fixed bottom-5 left-1/2 z-[150] max-w-[90vw] -translate-x-1/2 rounded-xl border border-indigo-300/30 bg-[#101a30] px-4 py-3 text-sm text-white shadow-xl">{delivery.status}{delivery.failed && <button className="ml-3 font-bold text-amber-200" onClick={delivery.retry}>Retry invite</button>}<Link to="/invite" className="ml-3 text-indigo-200">Invites</Link></div>;
}
