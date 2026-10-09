import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, MessageCircle, Plus, UserPlus, Users, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ProfileAvatar } from "@/components/social/ProfileAvatarPicker";
import { GroupAvatar } from "@/components/social/GroupAvatar";
import { groupAvatars } from "@/components/social/groupAvatarManifest";
import ClanChat from "@/components/social/ClanChat";
import UserLink from "@/components/social/UserLink";
import { shareRoomWithClan } from "@/components/social/clanShare";
import { acceptInviteState, getInviteDestination, getInviteGameLabel } from "@/components/social/inviteRoute";
import { respondToClanInvite } from "@/components/social/notificationActions";
import { loadClanJoinInvites, useDashboardData, type ClanJoinInvite } from "@/hooks/useDashboardData";
import { ui, useUiLanguage } from "@/i18n/ui";

type Group = { id: string; name: string; description: string; avatar_id: string; owner_id: string; invite_code: string; created_at: string };
type Member = { group_id: string; user_id: string; joined_at: string };
type Player = { id: string; username: string | null; display_name: string | null; avatar_id: string | null };
type Invite = { id: string; sender_id: string; sender_name: string; sender_avatar_id: string | null; game: string; game_route?: string | null; mode: string; room_code: string; created_at: string; status: "open" | "full" | "ended" };

/** Every game whose lobbies can be shared with a clan. `claims` says which lobby routes belong to the game. */
const shareGames = [
  { id: "chess", label: "Chess", create: "/games/chess/classic/multiplayer", claims: (route: string) => route === "/games/chess/classic/multiplayer" || /^\/games\/chess\/variants\/[a-z0-9-]+\/multiplayer$/.test(route) || route === "/chess-custom/play/multiplayer" },
  { id: "go", label: "Go", create: "/games/go/multiplayer", claims: (route: string) => route === "/games/go/multiplayer" },
  { id: "watten", label: "Watten", create: "/games/watten/multiplayer", claims: (route: string) => /^\/games\/watten\/multiplayer\/[34]$/.test(route) },
  { id: "schafkopf", label: "Schafkopf", create: "/games/schafkopf/multiplayer", claims: (route: string) => route === "/games/schafkopf/multiplayer" },
  { id: "atlas-arena", label: "Atlas Arena", create: "/games/atlas-arena/multiplayer", claims: (route: string) => route === "/games/atlas-arena/multiplayer" },
  { id: "eat-it", label: "Eat It", create: "/games/eat-it/multiplayer", claims: (route: string) => route === "/games/eat-it/multiplayer" },
  { id: "pluto-party", label: "Pluto Party", create: "/games/pluto-party", claims: (route: string) => route === "/games/pluto-party" },
];

const panel = "rounded-[28px] border-2 border-indigo-300/25 bg-[#101b34] p-5 shadow-[7px_7px_0_#090f20] sm:p-7";
const input = "w-full rounded-xl border border-indigo-200/20 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-amber-300";
const action = "rounded-xl border border-amber-200/35 bg-amber-300 px-4 py-2.5 text-sm font-black text-amber-950 transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50";

/** Clans (stored as community groups): members, shared lobbies and clan chat. */
export default function ClansPage() {
  useUiLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedClan = searchParams.get("clan");
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const { friends } = useDashboardData();
  // Invitations to join a clan: those waiting for my answer, and the friends I have already asked into the open clan.
  const [clanInvites, setClanInvites] = useState<ClanJoinInvite[]>([]);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarId, setAvatarId] = useState("chess-king");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [inviteGame, setInviteGame] = useState<string>("chess");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setClanInvites(await loadClanJoinInvites());
    const membership = await supabase.from("community_group_members").select("group_id,user_id,joined_at").eq("user_id", user.id);
    if (membership.error) { setError(membership.error.message); return; }
    const mine = (membership.data ?? []) as Member[];
    const ids = mine.map(row => row.group_id);
    if (!ids.length) { setGroups([]); setMembers([]); setPlayers([]); setSelectedId(null); return; }
    const [groupResult, memberResult] = await Promise.all([
      supabase.from("community_groups").select("id,name,description,avatar_id,owner_id,invite_code,created_at").in("id", ids).order("created_at"),
      supabase.from("community_group_members").select("group_id,user_id,joined_at").in("group_id", ids),
    ]);
    if (groupResult.error || memberResult.error) { setError(groupResult.error?.message ?? memberResult.error?.message ?? "Could not load clans"); return; }
    const nextMembers = (memberResult.data ?? []) as Member[];
    const userIds = [...new Set(nextMembers.map(row => row.user_id))];
    const profileResult = userIds.length ? await supabase.from("profiles").select("id,username,display_name,avatar_id").in("id", userIds) : { data: [] as Player[], error: null };
    setGroups((groupResult.data ?? []) as Group[]);
    setMembers(nextMembers);
    setPlayers((profileResult.data ?? []) as Player[]);
    setSelectedId(current => current && ids.includes(current) ? current : ids[0]);
  }, [user]);

  // A clan link (?clan=…) from a pop-up or the profile selects that clan.
  if (requestedClan && requestedClan !== selectedId && groups.some(group => group.id === requestedClan)) setSelectedId(requestedClan);
  function selectClan(id: string) {
    setSelectedId(id);
    setSearchParams({ clan: id }, { replace: true });
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    const refresh = async () => {
      const result = await supabase.rpc("get_community_game_invites", { p_group_id: selectedId });
      if (alive && !result.error) setInvites(((result.data ?? []) as Invite[]).filter(invite => invite.game !== "shogi"));
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !user) return;
    let alive = true;
    // Own rows only (others' invitations are private); reads as empty before the clan invitation migration.
    void supabase.from("community_group_invites").select("receiver_id").eq("group_id", selectedId).eq("sender_id", user.id).eq("status", "pending")
      .then(({ data }) => { if (alive) setInvitedIds((data ?? []).map(row => row.receiver_id as string)); });
    return () => { alive = false; };
  }, [selectedId, user]);

  const selected = groups.find(group => group.id === selectedId);
  const owned = groups.find(group => group.owner_id === user?.id);
  const selectedMembers = members.filter(member => member.group_id === selectedId);
  const invitable = friends.filter(friend => !selectedMembers.some(member => member.user_id === friend.id));
  function beginEdit() { if (!selected) return; setName(selected.name); setDescription(selected.description); setAvatarId(selected.avatar_id); setEditing(true); }
  async function run(actionFn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); setError(null);
    try { const result = await actionFn(); if (result.error) setError(result.error.message); else await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  async function saveGroup() {
    if (!name.trim() || busy) return;
    setBusy(true); setError(null);
    const result = selected && editing
      ? await supabase.rpc("update_community_group", { p_group_id: selected.id, p_name: name, p_description: description, p_avatar_id: avatarId })
      : await supabase.rpc("create_community_group", { p_name: name, p_description: description, p_avatar_id: avatarId });
    if (result.error) { setError(result.error.message); setBusy(false); return; }
    setEditing(false); setName(""); setDescription(""); await load();
    if (typeof result.data === "string") selectClan(result.data);
    setBusy(false);
  }
  async function joinGroup() {
    if (busy) return;
    setBusy(true); setError(null);
    const result = await supabase.rpc("join_community_group", { p_invite_code: joinCode });
    if (result.error) { setError(result.error.message); setBusy(false); return; }
    setJoinCode(""); await load(); selectClan(result.data as string);
    setBusy(false);
  }
  async function inviteFriend(friendId: string) {
    if (!selected || busy) return;
    setBusy(true); setError(null);
    const result = await supabase.rpc("invite_friend_to_clan", { p_group_id: selected.id, p_friend_id: friendId });
    if (result.error) setError(result.error.message); else setInvitedIds(current => [...current, friendId]);
    setBusy(false);
  }
  async function answerClanInvite(invite: ClanJoinInvite, accept: boolean) {
    if (busy) return;
    setBusy(true); setError(null);
    const failure = await respondToClanInvite(invite.id, accept);
    if (failure) setError(failure);
    await load();
    if (!failure && accept) selectClan(invite.group_id);
    setBusy(false);
  }
  async function shareGame() {
    if (!selected) return;
    const game = shareGames.find(item => item.id === inviteGame) ?? shareGames[0];
    await run(async () => {
      let route = game.create;
      if (game.id !== "go" && game.id !== "pluto-party") {
        // The code says which lobby it is; it must be a lobby of the game picked above.
        const found = await supabase.rpc("resolve_game_invite", { p_code: roomCode });
        if (found.error) return found;
        const match = ((found.data ?? []) as { game_route: string }[]).map(item => item.game_route).find(game.claims);
        if (!match) return { data: null, error: { message: `No ${game.label} lobby has this code` } };
        route = match;
      }
      const result = await shareRoomWithClan(selected.id, roomCode, route);
      if (!result.error) {
        setRoomCode("");
        const refreshed = await supabase.rpc("get_community_game_invites", { p_group_id: selected.id });
        if (!refreshed.error) setInvites(((refreshed.data ?? []) as Invite[]).filter(invite => invite.game !== "shogi"));
      }
      return result;
    });
  }
  async function joinGame(invite: Invite) {
    setBusy(true); setError(null);
    const displayName = profile?.display_name?.trim() || profile?.username?.trim() || "Player";
    if (invite.game_route) {
      // The game's own lobby checks the seats and refuses a full one.
      setBusy(false);
      navigate(getInviteDestination({ game: invite.game, gameCode: invite.room_code, gameRoute: invite.game_route }, { autoJoin: true }), { state: acceptInviteState() });
    } else if (invite.game === "chess") {
      const result = await supabase.rpc("join_chess_room", { p_code: invite.room_code, p_display_name: displayName });
      setBusy(false);
      if (result.error) { setError(result.error.message); return; }
      navigate(`/games/chess/classic/multiplayer/${result.data}`);
    } else {
      const { data, error: joinError } = await supabase.functions.invoke("strategy-match", { body: { op: "join", code: invite.room_code, name: displayName } });
      setBusy(false);
      if (joinError || data?.error || data?.gameType !== invite.game) { setError(joinError?.message ?? String(data?.error ?? "Lobby no longer matches this invite")); return; }
      navigate(`/games/${invite.game}/multiplayer/${data.code}`);
    }
  }

  if (!user) return <main className="mx-auto max-w-4xl px-4 py-16 text-center text-white"><h1 className="text-3xl font-black">{ui("Clans")}</h1><p className="mt-3 text-slate-300">{ui("Sign in to join a clan.")}</p><Link className="mt-5 inline-block text-amber-300 underline" to="/login">{ui("Log in")}</Link></main>;

  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-10 text-white sm:px-6">
    <header><p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">{ui("Community")}</p><h1 className="mt-2 text-4xl font-black">{ui("Clans")}</h1><p className="mt-2 text-slate-400">{ui("Build a crew, share a lobby, and play together.")}</p></header>
    {error && <div role="alert" className="rounded-xl border border-red-400/40 bg-red-950/50 p-4 text-red-200">{error}</div>}
    <div className="grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <div className={panel}><h2 className="text-lg font-black">{ui("Your clans")}</h2><div className="mt-4 space-y-2">{groups.map(group => <button key={group.id} type="button" onClick={() => selectClan(group.id)} aria-current={selectedId === group.id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left focus-visible:outline-2 focus-visible:outline-amber-300 ${selectedId === group.id ? "border-amber-300 bg-amber-300/10" : "border-white/10 hover:bg-white/5"}`}><GroupAvatar id={group.avatar_id} className="h-11 w-11" /><span className="min-w-0 truncate font-bold">{group.name}</span></button>)}{!groups.length && <p className="text-sm text-slate-400">{ui("No clans yet.")}</p>}</div></div>
        <div className={panel}><h2 className="font-black">{ui("Join with a code")}</h2><form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); void joinGroup(); }}><input aria-label={ui("Clan invite code")} className={input} value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} maxLength={8} placeholder={ui("8 character code")} /><button className={action} disabled={busy || !joinCode.trim()}>{ui("Join")}</button></form></div>
      </aside>
      <section className="space-y-6">
        {clanInvites.length > 0 && <div className={panel}><h2 className="flex items-center gap-2 text-xl font-black"><UserPlus size={20} className="text-amber-300" />{ui("Clan invitations")}</h2><div className="mt-4 space-y-3">{clanInvites.map(invite => <article key={invite.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/25 bg-amber-300/[.06] p-3"><GroupAvatar id={invite.group_avatar_id} className="h-12 w-12" /><div className="min-w-0 flex-1"><p className="truncate font-black">{invite.group_name}</p><p className="text-sm text-slate-400"><UserLink userId={invite.sender_id} className="font-semibold text-slate-200">{invite.sender_name}</UserLink> {ui("invited you to join")} · {invite.member_count} {ui("members")}</p></div><button type="button" disabled={busy} className={action} onClick={() => void answerClanInvite(invite, true)}>{ui("Accept")}</button><button type="button" disabled={busy} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold hover:bg-white/10 disabled:opacity-50" onClick={() => void answerClanInvite(invite, false)}>{ui("Decline")}</button></article>)}</div></div>}
        {!owned && !editing && <div className={panel}><h2 className="flex items-center gap-2 text-xl font-black"><Plus /> {ui("Create your clan")}</h2><p className="mt-1 text-sm text-slate-400">{ui("You can own one clan and join as many others as you like.")}</p><GroupForm {...{name,setName,description,setDescription,avatarId,setAvatarId,busy}} onSave={() => void saveGroup()} /></div>}
        {selected && <>
          <div className={panel}><div className="flex flex-wrap items-start gap-4"><GroupAvatar id={selected.avatar_id} className="h-20 w-20" /><div className="min-w-0 flex-1"><h2 className="text-3xl font-black">{selected.name}</h2><p className="mt-1 whitespace-pre-wrap text-slate-300">{selected.description || ui("A place to play together.")}</p><p className="mt-3 flex items-center gap-1 text-sm text-slate-400"><Users size={15} /> {selectedMembers.length} {ui("members")}</p></div>{selected.owner_id === user.id && <button className="rounded-xl border border-white/20 px-3 py-2 text-sm font-bold hover:bg-white/10" onClick={beginEdit}>{ui("Edit")}</button>}</div><div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4"><span className="text-sm text-slate-400">{ui("Invite code")} <strong className="ml-1 tracking-widest text-amber-200">{selected.invite_code}</strong></span><button type="button" aria-label={ui("Copy clan invite code")} className="rounded-lg border border-white/20 p-2 hover:bg-white/10" onClick={() => void navigator.clipboard.writeText(selected.invite_code)}><Copy size={15} /></button></div></div>
          <div className={panel}><h2 className="flex items-center gap-2 text-xl font-black"><UserPlus size={20} className="text-amber-300" />{ui("Invite friends")}</h2><p className="mt-1 text-sm text-slate-400">{ui("Invited friends get a notification and join as soon as they accept.")}</p>
            {invitable.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{invitable.map(friend => { const sent = invitedIds.includes(friend.id); return <div key={friend.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><ProfileAvatar avatarId={friend.avatar_id ?? "m1"} className="h-10 w-10 shrink-0 rounded-full" /><span className="min-w-0 flex-1 truncate font-semibold">{friend.display_name || friend.username || ui("Player")}</span><button type="button" disabled={busy || sent} className={sent ? "rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-slate-400" : action} onClick={() => void inviteFriend(friend.id)}>{ui(sent ? "Invited" : "Invite")}</button></div>; })}</div>
              : <p className="mt-4 text-sm text-slate-400">{friends.length ? ui("All your friends are already in this clan.") : <>{ui("You have no friends to invite yet.")} <Link className="font-bold text-amber-300 underline" to="/friends">{ui("Add friends")}</Link></>}</p>}
          </div>
          <div className={panel}><h2 className="mb-4 flex items-center gap-2 text-xl font-black"><MessageCircle size={20} className="text-teal-300" />{ui("Clan chat")}</h2><ClanChat clanId={selected.id} userId={user.id} players={players.filter(player => selectedMembers.some(member => member.user_id === player.id))} /></div>
          {editing && selected.owner_id === user.id && <div className={panel}><div className="flex items-center justify-between"><h2 className="text-xl font-black">{ui("Edit clan")}</h2><button aria-label={ui("Close editor")} onClick={() => setEditing(false)}><X /></button></div><GroupForm {...{name,setName,description,setDescription,avatarId,setAvatarId,busy}} onSave={() => void saveGroup()} /><button className="mt-5 text-sm text-red-300 underline" onClick={() => { if (window.confirm(`${ui("Disband")} ${selected.name}? ${ui("This removes its members, invites and chat.")}`)) void run(() => supabase.rpc("delete_community_group", { p_group_id: selected.id })); }}>{ui("Disband clan")}</button></div>}
          <div className={panel}><h2 className="text-xl font-black">{ui("Share a game")}</h2><p className="mt-1 text-sm text-slate-400">{ui("Create a casual lobby, then share its six character code here. Clan members get a pop-up.")}</p><div className="mt-4 flex flex-wrap gap-3"><select aria-label={ui("Game to share")} className={input} value={inviteGame} onChange={event => setInviteGame(event.target.value)}>{shareGames.map(item => <option key={item.id} value={item.id}>{ui(item.label)}</option>)}</select><Link className={action} to={(shareGames.find(item => item.id === inviteGame) ?? shareGames[0]).create}>{ui("Create a lobby")}</Link><form className="flex min-w-0 flex-1 gap-2" onSubmit={event => { event.preventDefault(); void shareGame(); }}><input aria-label={ui("Game lobby code")} className={input} value={roomCode} onChange={event => setRoomCode(event.target.value.toUpperCase())} maxLength={6} placeholder={ui("Lobby code")} /><button disabled={busy || roomCode.length !== 6} className={action}>{ui("Share")}</button></form></div></div>
          <div className={panel}><h2 className="text-xl font-black">{ui("Game invites")}</h2><div className="mt-4 space-y-3">{invites.map(invite => <article key={invite.id} className="rounded-2xl border-2 border-sky-300/30 bg-gradient-to-br from-sky-900/30 to-indigo-950 p-4"><div className="flex items-center gap-3"><UserLink userId={invite.sender_id}><ProfileAvatar avatarId={invite.sender_avatar_id ?? "m1"} className="h-10 w-10 rounded-full" /></UserLink><div><UserLink userId={invite.sender_id} className="font-bold">{invite.sender_name}</UserLink><p className="text-xs text-slate-400">{new Date(invite.created_at).toLocaleString()}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-sky-200">{ui(getInviteGameLabel({ game: invite.game, gameRoute: invite.game_route ?? (invite.game === "go" ? "/games/go/multiplayer" : undefined) }))} · Casual</p><p className="mt-1 font-mono text-xl tracking-widest">{invite.room_code}</p></div>{invite.status === "open" ? <button disabled={busy} className={action} onClick={() => void joinGame(invite)}>{ui("Join game")}</button> : <span className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-black">{ui(invite.status === "full" ? "Lobby full" : "Game ended")}</span>}</div></article>)}{!invites.length && <p className="text-sm text-slate-400">{ui("No shared lobbies yet.")}</p>}</div></div>
          <div className={panel}><h2 className="text-xl font-black">{ui("Members")}</h2><div className="mt-4 grid gap-2 sm:grid-cols-2">{selectedMembers.map(member => { const player = players.find(item => item.id === member.user_id); return <div key={member.user_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><UserLink userId={member.user_id} className="shrink-0"><ProfileAvatar avatarId={player?.avatar_id ?? "m1"} className="h-10 w-10 rounded-full" /></UserLink><span className="min-w-0 flex-1 truncate font-semibold"><UserLink userId={member.user_id}>{player?.display_name || player?.username || ui("Player")}</UserLink>{member.user_id === selected.owner_id && <small className="ml-2 text-amber-300">{ui("Leader")}</small>}</span>{selected.owner_id === user.id && member.user_id !== user.id && <button className="text-xs text-red-300 underline" onClick={() => void run(() => supabase.rpc("remove_community_member", { p_group_id: selected.id, p_user_id: member.user_id }))}>{ui("Remove")}</button>}</div>; })}</div>{selected.owner_id !== user.id && <button className="mt-5 text-sm text-slate-300 underline" onClick={() => void run(() => supabase.rpc("leave_community_group", { p_group_id: selected.id }))}>{ui("Leave clan")}</button>}</div>
        </>}
      </section>
    </div>
  </main>;
}

function GroupForm({ name, setName, description, setDescription, avatarId, setAvatarId, busy, onSave }: { name: string; setName: (value: string) => void; description: string; setDescription: (value: string) => void; avatarId: string; setAvatarId: (value: string) => void; busy: boolean; onSave: () => void }) {
  return <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); onSave(); }}><label className="block text-sm font-bold">{ui("Name")}<input className={`${input} mt-1`} value={name} onChange={event => setName(event.target.value)} minLength={3} maxLength={48} required /></label><label className="block text-sm font-bold">{ui("Description")}<textarea className={`${input} mt-1 min-h-24`} value={description} onChange={event => setDescription(event.target.value)} maxLength={500} /></label><fieldset><legend className="text-sm font-bold">{ui("Clan emblem")}</legend><div className="mt-2 grid max-h-56 grid-cols-5 gap-2 overflow-y-auto rounded-xl border border-white/10 p-2 sm:grid-cols-7">{groupAvatars.map(avatar => <button key={avatar.id} type="button" title={avatar.name} aria-label={avatar.name} aria-pressed={avatarId === avatar.id} onClick={() => setAvatarId(avatar.id)} className={`rounded-2xl p-1 focus-visible:outline-2 focus-visible:outline-amber-300 ${avatarId === avatar.id ? "bg-amber-300/35" : "hover:bg-white/10"}`}><GroupAvatar id={avatar.id} className="h-12 w-12" /></button>)}</div></fieldset><button disabled={busy} className={action}>{ui(busy ? "Saving…" : "Save clan")}</button></form>;
}
