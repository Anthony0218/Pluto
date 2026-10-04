import GoRankedHistory from "@/components/ranked/GoRankedHistory";
import GoRankedProfile from "@/components/ranked/GoRankedProfile";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import { getChessRank } from "@/games/chess/ranked/tiers";
import RankEmblem from "@/components/chess/RankEmblem";
import { featuredGames } from "@/data/dashboard";
import { Award, Crown, Flame, Gamepad2, Puzzle, Sparkles } from "lucide-react";
import { isTimeControl, timeControlLabel, type TimeControl } from "@/games/chess/ranked/timeControls";

import ProfileAvatarPicker, {
  ProfileAvatar,
} from "../../components/social/ProfileAvatarPicker";
import ProfileFriends from "../../components/social/ProfileFriends";
import MyGroupsCard from "../../components/social/MyGroupsCard";
import PixelAvatarEditor from "../../components/social/PixelAvatarEditor";
import { useCustomAvatars } from "@/components/social/useCustomAvatars";
import { isPixelAvatarId } from "../../components/social/pixelAvatar";
import DoNotDisturbSwitch, { ClanPopupsSwitch } from "../../components/App/notifications/DoNotDisturbSwitch";

type GameStat = {
  games_played: number;
  multiplayer_games: number;
  multiplayer_wins: number;
  wins: number;
  draws: number;
  score_difference: number;
};
type ProfileStats = {
  general: { games_played: number; wins: number };
  games: Record<string, GameStat>;
  streak: number;
  puzzles: number | null;
  perfectReallyHard: number | null;
  chessElo: number | null;
  /** Time control of `chessElo`: the player's best ranked rating. */
  chessEloMode: TimeControl | null;
};

type ProfileWithAvatar = {
  username?: string | null;
  avatar_id?: string | null;
};
type RecentResult = { game: string; outcome: "win" | "loss" | "draw"; multiplayer: boolean; completed_at: string; score_difference: number };

const emptyStats: ProfileStats = {
  general: { games_played: 0, wins: 0 },
  games: {},
  streak: 0,
  puzzles: null,
  perfectReallyHard: null,
  chessElo: null,
  chessEloMode: null,
};
/** The highest rating among the time controls the player has played ranked. */
function bestChessRating(rows: { time_control: string; rating: number; rated_games: number }[]) {
  const best = rows
    .filter((row) => row.rated_games > 0 && isTimeControl(row.time_control))
    .sort((left, right) => right.rating - left.rating)[0];
  return best
    ? { chessElo: best.rating, chessEloMode: best.time_control as TimeControl }
    : { chessElo: null, chessEloMode: null };
}

const emptyGameStat: GameStat = {
  games_played: 0,
  multiplayer_games: 0,
  multiplayer_wins: 0,
  wins: 0,
  draws: 0,
  score_difference: 0,
};
const trackedGames = new Set([
  "chess",
  "schafkopf",
  "watten",
  "atlas",
  "go",
  "eat-it",
]);
const statTabs = [
  { id: "general", label: "General" },
  { id: "chess", label: "Chess" },
  { id: "schafkopf", label: "Schafkopfen" },
  { id: "watten", label: "Watten" },
  { id: "natura", label: "Natura" },
  { id: "atlas", label: "Atlas Arena" },
  { id: "medieval", label: "Medieval Kingdoms" },
  { id: "go", label: "Go" },
  { id: "eat-it", label: "Eat It" },
] as const;

function StatCard({
  icon,
  value,
  label,
}: {
  icon: string;
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-indigo-300/10 bg-[#101d35]/80 p-5 transition hover:border-indigo-300/25">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>

        <span className="text-2xl font-black text-amber-300">{value}</span>
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        {ui(label)}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const { language } = useUiLanguage();
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [username, setUsername] = useState(() => profile?.username?.trim() || user?.email?.split("@")[0] || ui("Player"));
  const [avatarId, setAvatarId] = useState(() => profile?.avatar_id ?? "m1");

  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
  const [statTab, setStatTab] = useState<string>("general");

  const [editing, setEditing] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarTab, setAvatarTab] = useState<"presets" | "custom">("presets");
  const [creatingAvatar, setCreatingAvatar] = useState(false);
  const { customAvatars, saveCustomAvatar } = useCustomAvatars(user?.id, profile?.id === user?.id ? profile?.avatar_id : null);

  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  /* =========================================================
     PROFILE DATA
     ========================================================= */

  useEffect(() => {
    const typedProfile = profile as ProfileWithAvatar | null;

    const currentName =
      typeof typedProfile?.username === "string"
        ? typedProfile.username.trim()
        : "";

    const timer = window.setTimeout(() => {
      if (!editing) setUsername(currentName || user?.email?.split("@")[0] || ui("Player"));
      setAvatarId(typedProfile?.avatar_id ?? "m1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile, user?.email, editing]);

  /* =========================================================
     MEMBER SINCE
     ========================================================= */

  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat(language === "bar" ? "de" : language, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(user.created_at))
    : "—";

  /* =========================================================
     STATS
     ========================================================= */

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;

    async function loadStats() {
      setLoadingStats(true);

      const [result, activity, puzzles, rating, recent] = await Promise.all([
        supabase.rpc("get_my_game_stats"),
        supabase.rpc("get_dashboard_activity"),
        supabase.rpc("get_my_chess_puzzle_stats"),
        supabase
          .from("chess_ratings")
          .select("time_control,rating,rated_games")
          .eq("user_id", userId),
        supabase.from("user_game_results").select("game,outcome,multiplayer,completed_at,score_difference").eq("user_id", userId).order("completed_at", { ascending: false }).limit(4),
      ]);
      if (!active) return;
      if (!recent.error) setRecentResults((recent.data ?? []) as RecentResult[]);
      if (!result.error) {
        setStatsError(null);
        const data = result.data as Pick<ProfileStats, "general" | "games">;
        setStats({
          general: data?.general ?? emptyStats.general,
          games: data?.games ?? {},
          streak: Number(activity.data?.streak ?? 0),
          puzzles: puzzles.error ? null : Number(puzzles.data?.completed ?? 0),
          perfectReallyHard: puzzles.error
            ? null
            : Number(puzzles.data?.perfect_really_hard ?? 0),
          ...bestChessRating(rating.data ?? []),
        });
      } else
        setStatsError(
          ui(
            "Verified game statistics are unavailable until the database migrations are applied.",
          ),
        );

      setLoadingStats(false);
    }

    void loadStats();
    return () => { active = false; };
  }, [userId]);

  const totalGames = stats.general.games_played;
  const mostPlayed = Object.entries(stats.games)
    .filter(([, value]) => value.games_played > 0)
    .sort((a, b) => b[1].games_played - a[1].games_played)
    .slice(0, 3);
  const gameName = (id: string) =>
    statTabs.find((tab) => tab.id === id)?.label ?? id;
  const achievements = [
    { label: "First Victory", detail: "Win your first game", earned: stats.general.wins >= 1, Icon: Award, tone: "text-amber-300" },
    { label: "Chess Adept", detail: "Complete 10 chess games", earned: (stats.games.chess?.games_played ?? 0) >= 10, Icon: Crown, tone: "text-sky-300" },
    { label: "Streak Master", detail: "Reach a 7-day streak", earned: stats.streak >= 7, Icon: Flame, tone: "text-orange-300" },
    { label: "Puzzle Solver", detail: "Solve 10 puzzles", earned: (stats.puzzles ?? 0) >= 10, Icon: Puzzle, tone: "text-violet-300" },
    { label: "Versatile Player", detail: "Complete games in 3 categories", earned: Object.values(stats.games).filter(game => game.games_played > 0).length >= 3, Icon: Sparkles, tone: "text-teal-300" },
    { label: "Dedicated", detail: "Complete 100 games", earned: stats.general.games_played >= 100, Icon: Gamepad2, tone: "text-rose-300" },
  ];

  /* =========================================================
     USERNAME
     ========================================================= */

  async function saveUsername() {
    if (!user) {
      return;
    }

    const nextName = username.trim();

    if (nextName.length < 2) {
      setError(ui("Name must be at least 2 characters long."));
      return;
    }

    if (nextName.length > 30) {
      setError(ui("Name must be at most 30 characters long."));
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        username: nextName,
      })
      .eq("id", user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await refreshProfile();
    setUsername(nextName);
    setEditing(false);
    setMessage(ui("Name saved."));

    window.setTimeout(() => {
      setMessage(null);
    }, 1800);
  }

  /* =========================================================
     AVATAR
     ========================================================= */

  async function chooseAvatar(nextAvatarId: string) {
    if (!user || savingAvatar) {
      return;
    }

    const previousAvatar = avatarId;

    /*
     * Optimistic update:
     * avatar changes immediately in the UI.
     */
    setAvatarId(nextAvatarId);
    setSavingAvatar(true);
    setError(null);
    setMessage(null);

    if (isPixelAvatarId(nextAvatarId)) await saveCustomAvatar(nextAvatarId);

    const { error: avatarError } = await supabase
      .from("profiles")
      .update({
        avatar_id: nextAvatarId,
      })
      .eq("id", user.id);

    if (avatarError) {
      setSavingAvatar(false);
      setAvatarId(previousAvatar);
      setError(avatarError.message);
      return;
    }

    await refreshProfile();
    setSavingAvatar(false);
    setCreatingAvatar(false);
    setMessage(ui("Avatar saved."));

    window.setTimeout(() => {
      setMessage(null);
    }, 1800);
  }

  /* =========================================================
     NOT LOGGED IN
     ========================================================= */

  if (!user && authLoading) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-10 text-white" role="status">
        {ui("Loading...")}
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-10 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-900 p-8 text-center">
          <div className="text-5xl">👤</div>

          <h1 className="mt-5 text-2xl font-black">{ui("Not signed in")}</h1>

          <p className="mt-2 text-sm text-zinc-500">
            {ui("Sign in to view your profile.")}
          </p>
        </div>
      </main>
    );
  }

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <main className="min-h-[var(--app-height)] overflow-x-hidden bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,.15),_transparent_52%)] px-3 py-4 text-white sm:px-6 sm:py-5 lg:h-[var(--app-height)] lg:min-h-0 lg:overflow-hidden lg:py-3">
      <div className="mx-auto max-w-6xl lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        {/* HEADER */}

        <section className="relative mb-3 overflow-hidden rounded-[24px] border border-indigo-300/25 bg-[#0b1529] shadow-2xl shadow-black/30 sm:min-h-[190px] sm:rounded-[28px] lg:shrink-0">
          <img src={featuredGames[0]?.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071024] via-[#071024]/90 to-[#071024]/35 max-sm:bg-gradient-to-b max-sm:from-[#071024]/75 max-sm:to-[#071024]" />
          <div className="relative grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4 px-4 py-5 sm:flex sm:flex-wrap sm:gap-5 sm:px-8 sm:py-7">
            <button type="button" onClick={() => setAvatarPickerOpen(true)} className="group relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-2 border-indigo-300/70 bg-[#121d3d] p-1 shadow-[0_0_24px_rgba(129,140,248,.3)] sm:h-24 sm:w-24" aria-label={ui("Change avatar")}><ProfileAvatar avatarId={avatarId} className="h-full w-full rounded-xl" /></button>
            <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.22em] text-indigo-200 sm:text-[10px] sm:tracking-[.28em]">{ui("Pluto player profile")}</p><h1 className="mt-1 break-words text-2xl font-black leading-tight text-white sm:text-4xl">{username}</h1><p className="mt-1 text-xs text-indigo-100/80 sm:text-sm">{ui("Play. Learn. Grow together.")}</p></div>
            <div className="col-span-2 min-w-0 sm:ml-0 sm:max-w-sm sm:flex-1"><div className="mb-1 flex flex-wrap justify-between gap-x-3 text-[11px] font-semibold text-indigo-100 sm:text-xs"><span>{ui("Activity level")} {Math.floor((stats.general.games_played * 100 + (stats.puzzles ?? 0) * 50) / 1000) + 1}</span><span>{(stats.general.games_played * 100 + (stats.puzzles ?? 0) * 50) % 1000} / 1,000 XP</span></div><div className="h-2 overflow-hidden rounded-full bg-indigo-200/15"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-300" style={{ width: `${((stats.general.games_played * 100 + (stats.puzzles ?? 0) * 50) % 1000) / 10}%` }} /></div><p className="mt-1 text-[9px] leading-4 text-indigo-100/60 sm:text-[10px]">{ui("100 XP per completed game · 50 XP per completed puzzle")}</p></div>
            {stats.chessElo !== null && <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-amber-300/30 bg-[#06101e]/75 p-3 backdrop-blur sm:col-span-1"><RankEmblem family={getChessRank(stats.chessElo).family} size="sm" /><div><strong className="block text-sm text-amber-100">{ui(getChessRank(stats.chessElo).name)}</strong><small className="text-amber-200/70">{stats.chessElo} Elo · {timeControlLabel(stats.chessEloMode, ui)}</small></div></div>}
          </div>
        </section>

        <div className="grid min-h-0 gap-4 lg:flex-1 lg:grid-cols-[250px_minmax(0,1fr)]">
          {/* =================================================
              LEFT PROFILE CARD
              ================================================= */}

          <aside className="min-h-0 lg:overflow-y-auto">
            <div className="rounded-[22px] border border-indigo-300/15 bg-[#0b1529]/90 p-4 shadow-2xl shadow-black/30 sm:rounded-[26px] sm:p-5">
              {/* AVATAR */}

              <div className="hidden lg:block">
                <button
                  type="button"
                  onClick={() => setAvatarPickerOpen((current) => !current)}
                  className="
                    group
                    relative
                    h-16
                    w-16
                    overflow-hidden
                    rounded-2xl
                    border
                    border-white/10
                    bg-black/20
                    p-1
                    transition
                    hover:border-amber-400/40
                  "
                >
                  <ProfileAvatar
                    avatarId={avatarId}
                    className="h-full w-full rounded-xl"
                  />

                  <div
                    className="
                      absolute
                      inset-x-1
                      bottom-1
                      rounded-b-xl
                      bg-black/70
                      py-1.5
                      text-[10px]
                      font-black
                      text-white
                      opacity-0
                      backdrop-blur-sm
                      transition
                      group-hover:opacity-100
                    "
                  >
                    {ui("Change avatar")}
                  </div>
                </button>

                {savingAvatar && (
                  <p className="mt-2 text-xs text-zinc-600">
                    {ui("Saving avatar...")}
                  </p>
                )}
              </div>

              {/* NAME */}

              <div className="lg:mt-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  {ui("Player name")}
                </p>

                {!editing ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <h2 className="truncate text-2xl font-black">{username}</h2>

                    <button
                      type="button"
                      onClick={() => {
                        setEditing(true);
                        setError(null);
                        setMessage(null);
                      }}
                      className="
                        shrink-0
                        rounded-xl
                        border
                        border-white/10
                        bg-white/5
                        px-3
                        py-2
                        text-xs
                        font-black
                        text-zinc-300
                        transition
                        hover:bg-white/10
                        hover:text-white
                      "
                    >
                      {ui("Edit")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <input
                      autoFocus
                      value={username}
                      maxLength={30}
                      onChange={(event) => setUsername(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void saveUsername();
                        }

                        if (event.key === "Escape") {
                          const typedProfile =
                            profile as ProfileWithAvatar | null;

                          setUsername(
                            typedProfile?.username ||
                              user.email?.split("@")[0] ||
                              "Player",
                          );

                          setEditing(false);
                        }
                      }}
                      className="
                        w-full
                        rounded-xl
                        border
                        border-amber-400/30
                        bg-black/30
                        px-4
                        py-3
                        font-bold
                        outline-none
                        transition
                        focus:border-amber-300
                      "
                    />

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const typedProfile =
                            profile as ProfileWithAvatar | null;

                          setUsername(
                            typedProfile?.username ||
                              user.email?.split("@")[0] ||
                              "Player",
                          );

                          setEditing(false);
                        }}
                        className="
                          rounded-xl
                          border
                          border-white/10
                          bg-white/5
                          px-3
                          py-2.5
                          text-sm
                          font-black
                          text-zinc-400
                          transition
                          hover:bg-white/10
                        "
                      >
                        {ui("Cancel")}
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void saveUsername()}
                        className="
                          rounded-xl
                          bg-amber-400
                          px-3
                          py-2.5
                          text-sm
                          font-black
                          text-amber-950
                          transition
                          hover:bg-amber-300
                          disabled:opacity-50
                        "
                      >
                        {saving ? ui("Saving...") : ui("Save")}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* EMAIL */}

              <div className="mt-6 border-t border-white/5 pt-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  E-Mail
                </p>

                <p className="mt-2 break-all text-sm font-semibold text-zinc-300">
                  {user.email ?? "—"}
                </p>
              </div>

              {/* MEMBER SINCE */}

              <div className="mt-5 border-t border-white/5 pt-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  {ui("Member since")}
                </p>

                <p className="mt-2 text-sm font-semibold text-zinc-300">
                  {memberSince}
                </p>
              </div>

              {/* NOTIFICATIONS */}

              <div className="mt-5 border-t border-white/5 pt-5">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  {ui("Notifications")}
                </p>

                <DoNotDisturbSwitch userId={user.id} />
                <ClanPopupsSwitch userId={user.id} className="mt-2" />
              </div>

              {/* FEEDBACK */}

              {message && (
                <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-300">
                  ✓ {message}
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>
          </aside>

          {/* =================================================
              RIGHT CONTENT
              ================================================= */}

          <section className="min-h-0 space-y-3 lg:overflow-y-auto">
            {/* AVATAR PICKER */}

            {avatarPickerOpen && (
              <div className="rounded-[30px] border border-amber-400/15 bg-zinc-900/80 p-4 sm:p-6 shadow-xl shadow-black/20">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                      Avatar
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      {ui("Choose avatar")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {ui(avatarTab === "custom" ? "Choose a saved avatar or create a new one." : "Choose a preset avatar.")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAvatarPickerOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  >
                    {ui("Close")}
                  </button>
                </div>

                <div role="tablist" aria-label={ui("Avatar type")} className="mb-5 inline-flex rounded-xl border border-white/10 p-1">
                  {(["presets", "custom"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={avatarTab === tab}
                      onClick={() => { setAvatarTab(tab); setCreatingAvatar(false); }}
                      className={`rounded-lg px-4 py-1.5 text-xs font-black ${avatarTab === tab ? "bg-amber-300 text-black" : "text-zinc-400 hover:text-white"}`}
                    >
                      {ui(tab === "custom" ? "Custom" : "Presets")}
                    </button>
                  ))}
                </div>

                {avatarTab === "custom" ? (
                  <div role="tabpanel" aria-label={ui("Custom")}>
                    {creatingAvatar ? (
                      <PixelAvatarEditor
                        initialAvatarId={null}
                        saving={savingAvatar}
                        onCancel={() => setCreatingAvatar(false)}
                        onSave={(nextAvatarId) => { void chooseAvatar(nextAvatarId); }}
                      />
                    ) : (
                      <>
                        <button type="button" onClick={() => setCreatingAvatar(true)} disabled={savingAvatar} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-amber-950 transition hover:bg-amber-200 disabled:opacity-50"><Sparkles size={16} />{ui("Create avatar")}</button>
                        {customAvatars.length ? (
                          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                            {customAvatars.map((customAvatar, index) => (
                              <button key={customAvatar} type="button" disabled={savingAvatar} aria-pressed={avatarId === customAvatar} aria-label={`${ui("Custom avatar")} ${index + 1}`} onClick={() => { void chooseAvatar(customAvatar); }} className={`min-w-0 overflow-hidden rounded-2xl border p-1 transition hover:-translate-y-1 disabled:opacity-50 ${avatarId === customAvatar ? "border-amber-300 bg-amber-400/10 ring-2 ring-amber-400/20" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
                                <ProfileAvatar avatarId={customAvatar} className="aspect-square w-full rounded-xl" />
                                <span className="block py-1 text-[10px] font-bold text-zinc-400">{ui("Avatar")} {index + 1}</span>
                              </button>
                            ))}
                          </div>
                        ) : <p className="text-sm text-zinc-400">{ui("Your custom avatars will appear here.")}</p>}
                      </>
                    )}
                  </div>
                ) : (
                  <div role="tabpanel" aria-label={ui("Presets")}>
                    <ProfileAvatarPicker selected={avatarId} disabled={savingAvatar} onSelect={(nextAvatarId) => { void chooseAvatar(nextAvatarId); }} />
                  </div>
                )}
              </div>
            )}

            {/* STATISTICS */}

            <div className="rounded-[30px] border border-white/10 bg-zinc-900/80 p-6 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                    {ui("Statistics")}
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    {ui("Your stats")}
                  </h2>
                </div>

                {loadingStats && (
                  <span className="text-xs text-zinc-600">
                    {ui("Loading...")}
                  </span>
                )}
              </div>

              <div
                role="tablist"
                aria-label={ui("Game statistics")}
                className="mt-4 flex gap-2 overflow-x-auto pb-2"
                onKeyDown={(event) => {
                  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft")
                    return;
                  event.preventDefault();
                  const current = statTabs.findIndex(
                    (tab) => tab.id === statTab,
                  );
                  const next =
                    statTabs[
                      (current +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        statTabs.length) %
                        statTabs.length
                    ];
                  setStatTab(next.id);
                  document.getElementById(`stats-tab-${next.id}`)?.focus();
                }}
              >
                {statTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`stats-tab-${tab.id}`}
                    aria-selected={statTab === tab.id}
                    aria-controls="stats-panel"
                    tabIndex={statTab === tab.id ? 0 : -1}
                    onClick={() => setStatTab(tab.id)}
                    className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-amber-300 ${statTab === tab.id ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-white/10 text-slate-400 hover:text-white"}`}
                  >
                    {ui(tab.label)}
                  </button>
                ))}
              </div>
              <div
                id="stats-panel"
                role="tabpanel"
                aria-labelledby={`stats-tab-${statTab}`}
                className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {statsError ? (
                  <p
                    role="alert"
                    className="col-span-full text-sm text-amber-200"
                  >
                    {statsError}
                  </p>
                ) : statTab === "general" ? (
                  <>
                    <StatCard
                      icon="🎮"
                      label="Completed games"
                      value={loadingStats ? "…" : totalGames}
                    />
                    <StatCard
                      icon="🏆"
                      label="Total wins"
                      value={loadingStats ? "…" : stats.general.wins}
                    />
                    <StatCard
                      icon="🔥"
                      label="Day streak"
                      value={loadingStats ? "…" : stats.streak}
                    />
                  </>
                ) : statTab === "chess" ? (
                  <>
                    <StatCard
                      icon="♟"
                      label="Completed games"
                      value={
                        loadingStats
                          ? "…"
                          : (stats.games.chess?.games_played ?? 0)
                      }
                    />
                    <StatCard
                      icon="🏆"
                      label="Multiplayer wins"
                      value={
                        loadingStats
                          ? "…"
                          : (stats.games.chess?.multiplayer_wins ?? 0)
                      }
                    />
                    <StatCard
                      icon="📈"
                      label="Multiplayer win rate"
                      value={
                        loadingStats
                          ? "…"
                          : stats.games.chess?.multiplayer_games
                            ? `${Math.round((stats.games.chess.multiplayer_wins / stats.games.chess.multiplayer_games) * 100)}%`
                            : "—"
                      }
                    />
                    <StatCard
                      icon="🧩"
                      label="Completed puzzles"
                      value={loadingStats ? "…" : (stats.puzzles ?? "—")}
                    />
                    <StatCard
                      icon="✨"
                      label="Really Hard · zero mistakes"
                      value={
                        loadingStats ? "…" : (stats.perfectReallyHard ?? "—")
                      }
                    />
                    <StatCard
                      icon="♕"
                      label="Ranked ELO"
                      value={loadingStats ? "…" : (stats.chessElo ?? "—")}
                    />
                    {stats.chessElo !== null && <div className="flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[.06] p-3"><RankEmblem family={getChessRank(stats.chessElo).family} size="sm" /><div><strong className="block text-sm text-amber-100">{ui(getChessRank(stats.chessElo).name)}</strong><span className="text-xs text-zinc-400">{stats.chessElo} Elo · {timeControlLabel(stats.chessEloMode, ui)}</span></div></div>}
                  </>
                ) : trackedGames.has(statTab) ? (
                  <>
                    <StatCard
                      icon="🎮"
                      label="Completed games"
                      value={
                        loadingStats
                          ? "…"
                          : (stats.games[statTab] ?? emptyGameStat).games_played
                      }
                    />
                    <StatCard
                      icon="🏆"
                      label="Multiplayer wins"
                      value={
                        loadingStats
                          ? "…"
                          : (stats.games[statTab] ?? emptyGameStat)
                              .multiplayer_wins
                      }
                    />
                    {(statTab === "schafkopf" || statTab === "watten") && (
                      <StatCard
                        icon="➕"
                        label="Total score difference"
                        value={
                          loadingStats
                            ? "…"
                            : `${(stats.games[statTab] ?? emptyGameStat).score_difference >= 0 ? "+" : ""}${(stats.games[statTab] ?? emptyGameStat).score_difference}`
                        }
                      />
                    )}
                  </>
                ) : (
                  <p className="col-span-full text-sm text-slate-400">
                    {ui(
                      "No verified completion data is available for this game yet.",
                    )}
                  </p>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                {ui(
                  "Games played counts completed server-recorded results. The streak follows daily game visits. Puzzle totals come from saved puzzle completions.",
                )}
              </p>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <ProfileFriends userId={user.id} />
              <MyGroupsCard userId={user.id} />

              <section className="rounded-[26px] border border-indigo-400/15 bg-[#0b1529]/90 p-5 shadow-xl shadow-black/20"><div className="mb-3 flex items-center gap-2"><Award size={19} className="text-violet-300" /><h2 className="text-lg font-black">{ui("Achievements")}</h2></div><div className="grid grid-cols-2 gap-2">{achievements.map(item => <div key={item.label} className={`rounded-xl border p-3 ${item.earned ? "border-violet-300/30 bg-violet-400/10" : "border-white/5 bg-white/[.025] opacity-55"}`}><item.Icon size={24} className={item.tone} aria-hidden="true" /><strong className="mt-2 block text-xs text-white">{ui(item.label)}</strong><small className="text-[10px] text-slate-400">{ui(item.detail)}</small></div>)}</div></section>

              {user && <><GoRankedProfile userId={user.id} /><GoRankedHistory userId={user.id} /></>}
              <section className="rounded-[26px] border border-indigo-400/15 bg-[#0b1529]/90 p-5 shadow-xl shadow-black/20"><h2 className="text-lg font-black">{ui("Recent matches")}</h2>{recentResults.length ? <ol className="mt-3 grid gap-2">{recentResults.map((result, index) => <li key={`${result.game}-${result.completed_at}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.035] px-3 py-2"><div className="min-w-0"><strong className="block truncate text-sm text-white">{ui(gameName(result.game))}</strong><small className="text-xs text-slate-400">{new Date(result.completed_at).toLocaleDateString()} · {ui(result.multiplayer ? "Multiplayer" : "Singleplayer")}</small></div><span className={`rounded-lg border px-2 py-1 text-xs font-bold ${result.outcome === "win" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : result.outcome === "loss" ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-slate-400/30 bg-slate-400/10 text-slate-300"}`}>{ui(result.outcome)}</span></li>)}</ol> : <p className="mt-3 text-sm text-slate-400">{ui("No completed matches yet.")}</p>}</section>

              <section className="rounded-[26px] border border-indigo-400/15 bg-[#0b1529]/90 p-5 shadow-xl shadow-black/20">
                <h2 className="text-lg font-black">
                  {ui("Most Played Games")}
                </h2>
                {loadingStats ? (
                  <p className="mt-3 text-sm text-slate-400">
                    {ui("Loading...")}
                  </p>
                ) : mostPlayed.length ? (
                  <ol className="mt-3 grid gap-2">
                    {mostPlayed.map(([id, value], index) => (
                      <li
                        key={id}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                      >
                        <span className="text-amber-300">{index + 1}.</span>{" "}
                        {ui(gameName(id))}{" "}
                        <span className="text-slate-400">
                          — {value.games_played} {ui("games")}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">
                    {ui("No completed games yet.")}
                  </p>
                )}
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
