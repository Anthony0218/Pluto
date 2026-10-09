import { useState, type FormEvent } from "react";
import { Send, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { supabase } from "@/lib/supabase";
import { ui, useUiLanguage } from "@/i18n/ui";
import { clanStoredGame, shareRoomWithClan } from "./clanShare";
import { createInviteRoute } from "./gameCreationCatalog";
import { prepareCreatedGameInvite } from "./GameInviteDelivery";
import { normalizeLobbyCode } from "@/games/party/network/protocol";
import { useInviteGames } from "./useInviteGames";
import { getInviteGameLabel } from "./inviteRoute";

type RoomDestination = { game_route: string; mode: string };
const field = "mt-1 w-full min-w-0 rounded-xl border border-white/15 bg-[#10172a] px-3 py-2.5 text-sm text-white";
const lobbyRoute = (mode: { route: string; inviteRoute?: string }) => mode.inviteRoute ?? mode.route.split("?")[0];

/** Creates a lobby and invites a clan to it, or shares a lobby that already exists. Opened beside the navigation. */
export default function ClanInvitePanel({ onNavigate }: { onNavigate?: () => void }) {
  useUiLanguage();
  const { user } = useAuth();
  const { clans, loading } = useDashboardData();
  const navigate = useNavigate();
  const [gameId, setGameId] = useState("chess");
  const { games } = useInviteGames();
  const [modeId, setModeId] = useState("classic");
  const [clanId, setClanId] = useState("");
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<RoomDestination[]>([]), [route, setRoute] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const game = games.find(item => item.id === gameId) ?? games[0];
  const selectedMode = game?.modes.find(mode => mode.id === modeId) ?? game?.modes[0];
  const validClan = clans.some(clan => clan.id === clanId);
  const validCode = /^[A-Z0-9]{6}$/.test(code.trim().toUpperCase()) || Boolean(normalizeLobbyCode(code));

  function create() {
    if (!user || !selectedMode || !validClan) return;
    try {
      prepareCreatedGameInvite({ userId: user.id, clanId, route: lobbyRoute(selectedMode) });
      navigate(createInviteRoute(selectedMode));
      onNavigate?.();
    } catch { setError("Could not prepare the invite. Allow session storage and retry."); }
  }
  async function shareExisting(event?: FormEvent) {
    event?.preventDefault();
    if (!user || busy || !validClan || !validCode) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const partyCode = normalizeLobbyCode(code);
      const explicitParty = partyCode && /pluto/i.test(code);
      const { data, error: lookupError } = explicitParty ? { data: [], error: null } : await supabase.rpc("resolve_game_invite", { p_code: code.trim().toUpperCase() });
      if (lookupError) throw new Error(lookupError.message);
      const found = ((data ?? []) as RoomDestination[]).filter(room => clanStoredGame(room.game_route));
      if (!found.length && partyCode) found.push({ game_route: "/games/pluto-party", mode: "Pluto Party" });
      setRooms(found);
      if (!found.length) throw new Error("Room not found. Check the lobby code.");
      const room = found.length === 1 ? found[0] : found.find(item => item.game_route === route);
      if (!room) throw new Error("This code is used by multiple games. Choose the game below.");
      const { error: shareError } = await shareRoomWithClan(clanId, room.game_route === "/games/pluto-party" ? normalizeLobbyCode(code)! : code.trim().toUpperCase(), room.game_route);
      if (shareError) throw new Error(shareError.message);
      setMessage("Lobby shared with your clan.");
      setCode("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not share the lobby."); }
    finally { setBusy(false); }
  }

  return <section className="game-invite-panel rounded-2xl border border-indigo-300/20 bg-indigo-400/[.06] p-4 text-white" aria-label={ui("Clan invitations")}>
    <h2 className="flex items-center gap-2 text-lg font-bold"><Shield size={20} />{ui("Create & invite your clan")}</h2>
    {!user ? <Link className="mt-3 block text-sm text-indigo-200" to="/login" onClick={onNavigate}>{ui("Sign in")}</Link> : !loading && !clans.length ? <p className="mt-3 text-sm text-slate-300">{ui("You are not in a clan yet.")} <Link className="font-bold text-indigo-200 underline" to="/clans" onClick={onNavigate}>{ui("Find or create a clan")}</Link></p> : <>
      {game && <div className="invite-game-preview mt-3 flex items-center gap-3"><img src={game.image} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="font-bold">{game.title}</span></div>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="min-w-0 text-sm text-slate-300">{ui("Game")}<select aria-label={ui("Game")} className={field} value={game?.id ?? ""} disabled={busy} onChange={event => { setGameId(event.target.value); setModeId(""); }}>{games.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="min-w-0 text-sm text-slate-300">{ui("Mode")}<select aria-label={ui("Mode")} className={field} value={selectedMode?.id ?? ""} disabled={busy || !game?.modes.length} onChange={event => setModeId(event.target.value)}>{game?.modes.map(mode => <option key={mode.id} value={mode.id}>{ui(mode.label)}</option>)}</select></label>
      </div>
      <label className="mt-3 block text-sm text-slate-300">{ui("Choose a clan")}<select aria-label={ui("Choose a clan")} value={clanId} onChange={event => setClanId(event.target.value)} disabled={busy || loading} className={field}><option value="">{ui(loading ? "Loading clans..." : "Choose a clan")}</option>{clans.map(clan => <option key={clan.id} value={clan.id}>{clan.name}</option>)}</select></label>
      <button type="button" disabled={busy || !selectedMode || !validClan} onClick={create} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-3 text-sm font-bold disabled:opacity-40"><Send size={16} />{ui("Create & invite")}</button>
      <div className="mt-4 border-t border-white/10 pt-3">
        <form onSubmit={event => void shareExisting(event)} className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-sm text-slate-300">{ui("Game invite code")}<input aria-label={ui("Game invite code")} disabled={busy} placeholder="ABC123" maxLength={20} value={code} onChange={event => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "")); setRooms([]); setRoute(""); setError(""); setMessage(""); }} className={field} /></label>
        </form>
        {rooms.length > 1 && <label className="mt-2 block text-sm text-slate-300">{ui("Invited game")}<select disabled={busy} value={route} onChange={event => { setRoute(event.target.value); setError(""); }} className={field}><option value="">{ui("Choose a game")}</option>{rooms.map(room => <option key={room.game_route} value={room.game_route}>{ui(getInviteGameLabel({ game: undefined, gameRoute: room.game_route }))}</option>)}</select></label>}
        <button type="button" disabled={busy || !validCode || !validClan} onClick={() => void shareExisting()} className="mt-2 w-full text-sm font-bold text-indigo-200 disabled:opacity-40">{ui("Share existing lobby with clan")}</button>
      </div>
    </>}
    {error && <p role="alert" className="mt-3 text-sm leading-5 text-red-300">{ui(error)}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-300">{ui(message)}</p>}
  </section>;
}
