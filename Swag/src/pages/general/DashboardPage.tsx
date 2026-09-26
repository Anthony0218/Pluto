import MyGames from "../../components/App/MyGames";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Flame,
  Gamepad2,
  Mail,
  Search,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { games } from "../../data/games";
import { learningResources } from "../../data/navigation";
import {
  useDashboardData,
  type DashboardActivity,
  type DashboardNotification,
} from "../../hooks/useDashboardData";
import type { Friend } from "../../types/social";
import DashboardPlayCarousel from "../../components/App/DashboardPlayCarousel";
import FriendAvatar from "../../components/social/FriendAvatar";
import FriendChat from "../../components/social/FriendChat";

const panel = "rounded-2xl border border-white/[0.08] bg-[#080d1c]/85 p-5";
const textLink =
  "inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200";
const friendName = (friend: Friend) =>
  friend.username || friend.display_name || "Player";

export default function DashboardPage() {
  useUiLanguage();
  const { user, profile, loading: authLoading } = useAuth();
  const { activity, friends, onlineIds, notifications, loading, activityError, friendsError } =
    useDashboardData();
  const [search, setSearch] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [lastNotificationsRead, setLastNotificationsRead] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!user) { setLastNotificationsRead(0); return; }
    setLastNotificationsRead(Number(window.localStorage.getItem(`pluto-notifications-read-${user.id}`) || 0));
  }, [user]);
  const hour = new Date(now).getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName =
    profile?.username?.trim() || profile?.display_name?.trim();
  const onlineFriends = friends.filter((friend) =>
    onlineIds.includes(friend.id),
  );
  const selectedFriend = friends.find(
    (friend) => friend.id === selectedFriendId,
  );
  const query = search.trim().toLocaleLowerCase();
  const matchingGames = games.filter((game) =>
    `${game.title} ${game.description}`.toLocaleLowerCase().includes(query),
  );
  const matchingLessons = learningResources.filter((item) =>
    `${item.title} ${item.description}`.toLocaleLowerCase().includes(query),
  );
  const matchingFriends = friends.filter((friend) =>
    `${friend.username ?? ""} ${friend.display_name ?? ""}`
      .toLocaleLowerCase()
      .includes(query),
  );
  const recentGames = (activity?.recent_games ?? []).flatMap((visit) => {
    const game = games.find((item) => item.route === visit.game_route);
    return game ? [game] : [];
  });
  const wins = profile?.wins;
  const played = profile?.games_played;
  const winRate =
    played && wins != null
      ? Math.min(100, Math.round((wins / played) * 100))
      : 0;
  const unreadNotifications = notifications.filter((item) => Date.parse(item.createdAt) > lastNotificationsRead);
  const openNotifications = () => {
    setNotificationsOpen((open) => !open);
    const readAt = Date.now();
    setLastNotificationsRead(readAt);
    if (user) window.localStorage.setItem(`pluto-notifications-read-${user.id}`, String(readAt));
  };

  return (
    <main className="min-h-screen bg-transparent text-zinc-100">
      <div className="mx-auto max-w-[1550px] px-5 py-7 sm:px-7 xl:px-9">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="min-w-0">
            <div className="relative mb-8 max-w-xl">
              <Search
                size={18}
                className="absolute left-4 top-3.5 text-zinc-400"
              />
              <input
                aria-label={ui("Search games, learning resources and friends")}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={ui("Search games, learning resources, friends...")}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1020]/75 pl-11 pr-4 text-sm outline-none placeholder:text-zinc-500 focus:border-indigo-400/50"
              />
              {query && (
                <div className="absolute inset-x-0 top-13 z-30 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-[#0c1226] p-3 shadow-2xl">
                  {matchingGames.map((game) => (
                    <SearchLink
                      key={game.route}
                      title={game.title}
                      type="Game"
                      route={game.route}
                    />
                  ))}
                  {matchingLessons.map((item) => (
                    <SearchLink
                      key={item.route}
                      title={item.title}
                      type="Learn"
                      route={item.route}
                    />
                  ))}
                  {matchingFriends.map((friend) => (
                    <button
                      type="button"
                      key={friend.id}
                      onClick={() => {
                        setSelectedFriendId(friend.id);
                        setSearch("");
                      }}
                      className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-white/5"
                    >
                      <FriendAvatar profile={friend} size="sm" />
                      <span>{friendName(friend)}</span>
                      <span className="ml-auto text-xs text-zinc-400">{ui("Chat")}</span>
                    </button>
                  ))}
                  {!matchingGames.length &&
                    !matchingLessons.length &&
                    !matchingFriends.length && (
                      <p className="p-3 text-sm text-zinc-400">{ui("No results found.")}</p>
                    )}
                </div>
              )}
            </div>
            <section className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {ui(greeting)}
                {displayName ? `, ${displayName}` : ""} 👋
              </h1>
              <p className="mt-2 text-zinc-400">{ui("A little progress each day leads to big results.")}</p>
              {!user && !authLoading && (
                <p className="mt-3 text-sm text-zinc-300">
                  <Link to="/login" className="text-indigo-300 underline">{ui("Log in")}</Link>{" "}{ui("to see your progress and friends.")}</p>
              )}
              {user && !profile && !authLoading && (
                <p className="mt-3 text-sm text-zinc-400">{ui("Your profile couldn’t be loaded.")}{" "}
                  <Link to="/profile" className="text-indigo-300">{ui("Open profile")}</Link>
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <StatChip
                  icon={<Flame size={17} className="text-orange-400" />}
                  value={activity?.streak}
                  label={ui("day activity streak")}
                />
                <StatChip
                  icon={<Trophy size={17} className="text-indigo-300" />}
                  value={played}
                  label={ui("games played")}
                />
                <StatChip
                  icon={<BarChart3 size={17} className="text-violet-300" />}
                  value={profile?.rating}
                  label={ui("rating")}
                />
                <StatChip
                  icon={<Users size={17} className="text-emerald-400" />}
                  value={
                    !user || loading || friendsError
                      ? null
                      : onlineFriends.length
                  }
                  label={ui("friends online")}
                />
              </div>
            </section>
            <MyGames />
            <DashboardPlayCarousel />
            <section className="mt-6">
              <SectionHeader
                title={ui("Recently explored")}
                action={ui("View all games")}
                to="/games"
              />
              {loading ? (
                <p className={`${panel} text-sm text-zinc-400`}>{ui("Loading your games…")}</p>
              ) : activityError ? (
                <p className={`${panel} text-sm text-zinc-400`}>{ui("Your recent activity is unavailable. You can still browse all games.")}</p>
              ) : recentGames.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {recentGames.slice(0, 3).map((game) => (
                    <Link
                      key={game.route}
                      to={game.route}
                      className="group relative min-h-44 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020]"
                    >
                      <img
                        src={game.image}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                      <div className="relative flex min-h-44 flex-col justify-end p-5">
                        <h3 className="text-xl font-semibold">{ui(game.title)}</h3>
                        <p className="mt-1 text-sm text-zinc-300">
                          {ui(game.subtitle)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className={panel}>
                  <p className="text-sm text-zinc-400">
                    {user ? ui("Games you explore will appear here. Choose a game above to get started.") : ui("Log in to keep your game activity across visits.")}
                  </p>
                </div>
              )}
            </section>
            <section className="mt-6">
              <SectionHeader
                title={ui("Learn something new")}
                action={ui("View all resources")}
                to="/learn"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {learningResources.slice(0, 2).map((resource) => (
                  <Link
                    key={resource.route}
                    to={resource.route}
                    className={`${panel} transition hover:border-indigo-400/30`}
                  >
                    <h3 className="font-semibold">{ui(resource.title)}</h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      {ui(resource.description)}
                    </p>
                    <span className={`${textLink} mt-4`}>{ui("Start learning")}<ArrowRight size={14} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className={panel}>
              <SectionHeader
                title={ui("Your Progress")}
                action={ui("See details")}
                to="/profile"
              />
              {profile ? (
                <>
                  <Link to="/profile" className="mt-5 flex items-center gap-3">
                    <FriendAvatar profile={profile} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {displayName || "Player"}
                      </p>
                      <p className="text-xs text-zinc-400">{ui("Your saved profile stats")}</p>
                    </div>
                  </Link>
                  <div className="mt-5 flex items-center gap-4">
                    <div
                      role="img"
                      aria-label={`${winRate}% win rate`}
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(#8b5cf6 ${winRate}%, #1f2937 ${winRate}% 100%)`,
                      }}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#080d1c] text-lg font-bold">
                        {played ? `${winRate}%` : "—"}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold">{ui("Win rate")}</p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {played ? `${wins ?? 0} wins in ${played} recorded games` : ui("No completed games recorded yet.")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {[
                      ["Wins", profile.wins],
                      ["Draws", profile.draws],
                      ["Losses", profile.losses],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-center"
                      >
                        <p className="font-bold">{value ?? "—"}</p>
                        <p className="mt-1 text-xs text-zinc-400">{ui(label)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-zinc-400">
                  {authLoading ? ui("Loading profile…") : user ? ui("Your profile stats are unavailable.") : ui("Log in to see your saved stats.")}
                </p>
              )}
            </section>
            <DailyChallenge
              challenge={activity?.challenge ?? null}
              now={now}
              loading={loading}
              unavailable={activityError}
              signedIn={!!user}
            />
            <section className={panel}>
              <SectionHeader
                title={`Friends Online${!user || loading || friendsError ? "" : ` (${onlineFriends.length})`}`}
                action={ui("View all")}
                to="/friends"
              />
              <div className="mt-4 border-b border-white/10 pb-4">
                <button type="button" aria-expanded={notificationsOpen} onClick={openNotifications} className="flex w-full items-center gap-3 rounded-xl border border-indigo-300/20 bg-indigo-400/[0.06] p-3 text-left hover:bg-indigo-400/[0.1]">
                  <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-indigo-400/15 text-indigo-200"><Bell size={18} />{unreadNotifications.length > 0 && <i className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080d1c] bg-red-500" />}</span>
                  <span className="min-w-0 flex-1"><strong className="block text-sm text-zinc-100">Friend notifications</strong><small className="block text-xs text-zinc-400">{unreadNotifications.length ? `${unreadNotifications.length} new message${unreadNotifications.length === 1 ? "" : "s"} or request${unreadNotifications.length === 1 ? "" : "s"}` : "Messages, invites and friend requests"}</small></span>
                  <span className="text-xs text-indigo-200">{notificationsOpen ? "Close" : "Open"}</span>
                </button>
                {notificationsOpen && <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/15 p-2">{notifications.length ? notifications.slice(0, 6).map((item) => <NotificationLink key={item.id} item={item} unread={Date.parse(item.createdAt) > lastNotificationsRead} onOpen={() => setNotificationsOpen(false)} />) : <p className="px-2 py-4 text-center text-sm text-zinc-400">No friend notifications yet.</p>}</div>}
              </div>
              {loading ? (
                <p className="mt-4 text-sm text-zinc-400">{ui("Loading friends…")}</p>
              ) : friendsError ? (
                <p className="mt-4 text-sm text-zinc-400">{ui("Online status is temporarily unavailable.")}</p>
              ) : onlineFriends.length ? (
                <div className="mt-4 space-y-2">
                  {onlineFriends.map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => setSelectedFriendId(friend.id)}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5"
                    >
                      <FriendAvatar profile={friend} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {friendName(friend)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{ui("Online")}</p>
                      </div>
                      <span className="rounded-lg border border-indigo-400/20 px-3 py-2 text-xs text-indigo-300">{ui("Chat")}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-400">
                  {!user ? ui("Log in to connect with your friends.") : friends.length ? ui("None of your friends are online right now. You can still message them from Friends.") : ui("No friends yet. Find someone by username on the Friends page.")}
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
      {selectedFriend && (
        <ChatDialog
          key={selectedFriend.id}
          friend={selectedFriend}
          onClose={() => setSelectedFriendId(null)}
        />
      )}
    </main>
  );
}

function NotificationLink({ item, unread, onOpen }: { item: DashboardNotification; unread: boolean; onOpen: () => void }) {
  const to = item.kind === "friend_request" ? "/friends" : item.gameRoute === "/games/atlas-arena/multiplayer" && item.gameCode ? `${item.gameRoute}/${item.gameCode}` : "/friends";
  const Icon = item.kind === "friend_request" ? Users : item.gameCode ? Gamepad2 : Mail;
  return <Link to={to} onClick={onOpen} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-white/5"><span className={`grid h-8 w-8 place-items-center rounded-lg ${item.kind === "friend_request" ? "bg-violet-400/15 text-violet-200" : "bg-sky-400/15 text-sky-200"}`}><Icon size={16} /></span><span className="min-w-0 flex-1"><strong className="flex items-center gap-2 text-sm text-zinc-100">{item.title}{unread && <i className="h-2 w-2 rounded-full bg-red-500" />}</strong><small className="block truncate text-xs text-zinc-400">{item.detail}</small></span></Link>;
}

function DailyChallenge({
  challenge,
  now,
  loading,
  unavailable,
  signedIn,
}: {
  challenge: DashboardActivity["challenge"];
  now: number;
  loading: boolean;
  unavailable: boolean;
  signedIn: boolean;
}) {
  useUiLanguage();
  const minutes = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.expires_at) - now) / 60_000))
    : 0;
  const progress = challenge
    ? Math.min(challenge.progress, challenge.target)
    : 0;
  const completed = !!challenge && progress >= challenge.target;
  return (
    <section className={panel}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{ui("Daily Challenge")}</h2>
        {challenge && (
          <span className="text-xs text-zinc-400">
            {minutes > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m left` : ui("Refreshing…")}
          </span>
        )}
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-zinc-400">{ui("Loading challenge…")}</p>
      ) : !challenge ? (
        <p className="mt-4 text-sm text-zinc-400">
          {!signedIn ? ui("Log in to track your daily challenge.") : unavailable ? ui("Your daily challenge is temporarily unavailable.") : ui("No challenge is available today.")}
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <Target size={30} className="shrink-0 text-indigo-300" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{ui(challenge.title)}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                {ui(challenge.description)}
              </p>
              <progress
                aria-label={ui("Daily challenge progress")}
                max={challenge.target}
                value={progress}
                className="mt-3 h-2 w-full accent-indigo-500"
              />
              <p className="mt-1 text-xs text-zinc-300">
                {progress} / {challenge.target}
                {completed ? ui(" · Completed!") : ""}
              </p>
            </div>
          </div>
          <Link to="/games" className={`${textLink} mt-4`}>
            {completed ? ui("Explore more games") : ui("Choose a game")}
            <ArrowRight size={14} />
          </Link>
        </>
      )}
    </section>
  );
}

function SectionHeader({
  title,
  action,
  to,
}: {
  title: string;
  action: string;
  to: string;
}) {
  useUiLanguage();
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{ui(title)}</h2>
      <Link to={to} className={`${textLink} shrink-0`}>
        {ui(action)}
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}
function StatChip({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number | null | undefined;
  label: string;
}) {
  useUiLanguage();
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#0b1020]/70 px-4 py-2.5">
      {icon}
      <span className="text-sm font-semibold">
        {value?.toLocaleString() ?? "—"}
      </span>
      <span className="text-xs text-zinc-400">{ui(label)}</span>
    </div>
  );
}
function SearchLink({
  title,
  type,
  route,
}: {
  title: string;
  type: string;
  route: string;
}) {
  useUiLanguage();
  return (
    <Link
      to={route}
      className="flex items-center justify-between gap-3 rounded-lg p-3 text-sm hover:bg-white/5"
    >
      {ui(title)}
      <span className="text-xs text-zinc-400">{type}</span>
    </Link>
  );
}
function ChatDialog({
  friend,
  onClose,
}: {
  friend: Friend;
  onClose: () => void;
}) {
  useUiLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={`Chat with ${friendName(friend)}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[min(680px,95vw)] max-w-none overflow-y-auto rounded-3xl border border-white/10 bg-[#080d1c] p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-md"
    >
      <div>
        <div className="flex justify-end p-2">
          <button
            autoFocus
            type="button"
            onClick={onClose}
            aria-label={ui("Close chat")}
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
        <FriendChat friend={friend} />
      </div>
    </dialog>
  );
}
