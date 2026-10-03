import { useEffect, useState, type FormEvent } from "react";
import { Gamepad2, Send } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { supabase } from "@/lib/supabase";
import { ui, useUiLanguage } from "@/i18n/ui";
import { modeForOnline } from "@/games/atlas/modeCatalog";
import { normalizeLobbyCode } from "@/games/party/network/protocol";
import { useCardGameRepository } from "@/games/cards/storage/useCardGameRepository";
import { latestPublished } from "@/games/cards/versioning";
import { currentRoomInvite, getInviteDestination, getInviteGameLabel } from "./inviteRoute";
import { INVITE_GAMES, createInviteRoute, type InviteMode } from "./gameCreationCatalog";
import { prepareCreatedGameInvite } from "./GameInviteDelivery";
type RoomDestination = { game_route: string; mode: string };
const field = "mt-1 w-full min-w-0 rounded-xl border border-white/15 bg-[#10172a] px-3 py-2.5 text-sm text-white";
export default function GameInvitePanel({ onNavigate, initialFriendId = "", compact = false }: { onNavigate?: () => void; initialFriendId?: string; compact?: boolean }) {
  useUiLanguage();
  const { user } = useAuth();
  const { friends, onlineIds, loading, friendsError } = useDashboardData();
  const { repository } = useCardGameRepository();
  const navigate = useNavigate(), location = useLocation();
  const current = currentRoomInvite(location.pathname, location.search);
  const [view, setView] = useState<"create" | "code">("create");
  const showCreate = !compact || view === "create", showCode = !compact || view === "code";
  const [code, setCode] = useState(current?.code ?? "");
  const [friendId, setFriendId] = useState(initialFriendId);
  const [gameId, setGameId] = useState("chess");
  const [modeId, setModeId] = useState("classic");
  const [cardModes, setCardModes] = useState<InviteMode[]>([]);
  const [cardsError, setCardsError] = useState("");
  const [rooms, setRooms] = useState<RoomDestination[]>([]), [route, setRoute] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const game = INVITE_GAMES.find(item => item.id === gameId)!;
  const modes = gameId === "card-builder" ? cardModes : game.modes;
  const selectedMode = modes.find(mode => mode.id === modeId) ?? modes[0];
  const validCode = /^[A-Z0-9]{6}$/.test(code.trim().toUpperCase()) || Boolean(normalizeLobbyCode(code));
  const validFriend = friends.some(friend => friend.id === friendId);
  useEffect(() => {
    if (gameId !== "card-builder" || repository.kind !== "cloud") return;
    let active = true;
    void repository.list().then(records => {
      if (!active) return;
      setCardModes(records.flatMap(record => { const version = latestPublished(record); return version ? [{ id: version.id, label: `${record.name} · v${version.version}`, route: `/games/card-builder/play?game=${record.id}&version=${version.id}&mode=online`, inviteRoute: "/games/card-builder/room" }] : []; }));
      setCardsError("");
    }).catch(() => { if (active) setCardsError("Published games could not be loaded. Select Card Builder again to retry."); });
    return () => { active = false; };
  }, [gameId, repository]);
  function create() {
    if (!user || !selectedMode || !validFriend) return;
    try {
      prepareCreatedGameInvite({ userId: user.id, friendId, route: selectedMode.inviteRoute ?? selectedMode.route.split("?")[0] });
      navigate(createInviteRoute(selectedMode));
      onNavigate?.();
    } catch { setError("Could not prepare the invite. Allow session storage and retry."); }
  }
  async function resolve() {
    const partyCode = normalizeLobbyCode(code);
    if (partyCode && /pluto/i.test(code)) return { game_route: "/games/pluto-party", mode: "Pluto Party" };
    const { data, error } = await supabase.rpc("resolve_game_invite", { p_code: code.trim().toUpperCase() });
    if (error) throw new Error(error.message);
    const found = (data ?? []) as RoomDestination[];
    setRooms(found);
    if (!found.length && partyCode) return { game_route: "/games/pluto-party", mode: "Pluto Party" };
    if (!found.length) throw new Error("Room not found. Check the code with your friend.");
    const room = found.length === 1 ? found[0] : found.find(item => item.game_route === route);
    if (!room) throw new Error("This code is used by multiple games. Choose the invited game below.");
    return room;
  }
  async function act(action: "join" | "invite", event?: FormEvent) {
    event?.preventDefault();
    if (!user || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (action === "invite" && !validFriend) throw new Error("Choose a friend to invite.");
      const room = await resolve();
      const normalizedCode = room.game_route === "/games/pluto-party" ? normalizeLobbyCode(code)! : code.trim().toUpperCase();
      const inviteGame = room.game_route.startsWith("/games/watten/multiplayer") ? "watten" : "chess";
      if (action === "join") {
        navigate(getInviteDestination({ game: inviteGame, gameCode: normalizedCode, gameRoute: room.game_route }, { autoJoin: true }));
        onNavigate?.();
      } else {
        const { error } = await supabase.from("friend_messages").insert({ sender_id: user.id, receiver_id: friendId, message_type: "game_code", game: inviteGame, game_code: normalizedCode, game_route: room.game_route });
        if (error) throw new Error(error.message);
        setMessage("Invite sent.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open the invite."); }
    finally { setBusy(false); }
  }
  return <section className="game-invite-panel rounded-2xl border border-indigo-300/20 bg-indigo-400/[.06] p-4 text-white" aria-label={ui("Game invitations")}>
    <h2 className="flex items-center gap-2 text-lg font-bold"><Gamepad2 size={20} />{ui("Create & invite")}</h2>
    {!user ? <Link className="mt-3 block text-sm text-indigo-200" to="/login" onClick={onNavigate}>{ui("Sign in")}</Link> : <>
      {compact && <div className="mt-3 flex gap-2" role="group" aria-label={ui("Invitation action")}>{(["create", "code"] as const).map(action => <button type="button" key={action} aria-pressed={view === action} onClick={() => setView(action)} className={`flex-1 rounded-lg px-2 py-2 text-sm font-bold ${view === action ? "bg-indigo-400/20 text-indigo-200" : "bg-white/5 text-slate-400"}`}>{ui(action === "create" ? "Create & invite" : "Use a code")}</button>)}</div>}
      {showCreate && <><div className="invite-game-preview mt-3 flex items-center gap-3"><img src={game.image} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="font-bold">{game.title}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="min-w-0 text-sm text-slate-300">{ui("Game")}<select aria-label={ui("Game")} className={field} value={gameId} disabled={busy} onChange={event => { setGameId(event.target.value); setModeId(""); setCardsError(""); }}>{INVITE_GAMES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="min-w-0 text-sm text-slate-300">{ui("Mode")}<select aria-label={ui("Mode")} className={field} value={selectedMode?.id ?? ""} disabled={busy || !modes.length} onChange={event => setModeId(event.target.value)}>{!modes.length && <option value="">{ui("No online modes")}</option>}{modes.map(mode => <option key={mode.id} value={mode.id}>{ui(mode.label)}</option>)}</select></label>
      </div>
      {cardsError && <p role="alert" className="mt-2 text-sm text-red-300">{ui(cardsError)}</p>}
      {!modes.length && !cardsError && <p className="mt-2 text-sm text-slate-400">{ui(gameId === "card-builder" ? "Publish a card game in your account to invite friends." : "This game does not have online multiplayer yet.")}</p>}
      </>}<label className="mt-3 block text-sm text-slate-300">{ui("Choose a friend")}<select aria-label={ui("Choose a friend")} value={friendId} onChange={event => setFriendId(event.target.value)} disabled={busy || loading || friendsError} className={field}><option value="">{ui(loading ? "Loading friends..." : friendsError ? "Friends are unavailable" : "Choose a friend")}</option>{[...friends].sort((a,b) => Number(onlineIds.includes(b.id))-Number(onlineIds.includes(a.id))).map(friend => <option key={friend.id} value={friend.id}>{friend.display_name || friend.username || "Player"}{onlineIds.includes(friend.id) ? ` · ${ui("Online")}` : ""}</option>)}</select></label>
      {showCreate && <button type="button" disabled={busy || !selectedMode || !validFriend} onClick={create} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-3 text-sm font-bold disabled:opacity-40"><Send size={16} />{ui("Create & invite")}</button>}
      {showCode && <div className="mt-4 border-t border-white/10 pt-3"><form onSubmit={event => void act("join", event)} className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm text-slate-300">{ui("Game invite code")}<input aria-label={ui("Game invite code")} disabled={busy} placeholder="ABC123" value={code} onChange={event => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "")); setRooms([]); setRoute(""); setMessage(""); setError(""); }} minLength={6} maxLength={20} required className={field + " font-mono tracking-widest"} /></label><button type="submit" disabled={busy || !validCode} className="min-h-10 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-bold disabled:opacity-40">{ui(busy ? "Loading…" : "Join")}</button></form>
      {rooms.length > 1 && <label className="mt-2 block text-sm text-slate-300">{ui("Invited game")}<select disabled={busy} value={route} onChange={event => { setRoute(event.target.value); setError(""); }} className={field}><option value="">{ui("Choose a game")}</option>{rooms.map(room => <option key={room.game_route} value={room.game_route}>{getInviteGameLabel({ gameRoute: room.game_route })} · {modeForOnline(room.mode)?.title ?? room.mode}</option>)}</select></label>}
      <button type="button" disabled={busy || !validCode || !validFriend} onClick={() => void act("invite")} className="mt-2 w-full text-sm font-bold text-indigo-200 disabled:opacity-40">{ui("Send existing room invite")}</button></div>}
    </>}
    {error && <p role="alert" className="mt-3 text-sm leading-5 text-red-300">{ui(error)}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-300">{ui(message)}</p>}
  </section>;
}
