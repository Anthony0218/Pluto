import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";

import ProfileAvatarPicker, {
  ProfileAvatar,
} from "../../components/social/ProfileAvatarPicker";
import ProfileFriends from "../../components/social/ProfileFriends";
import MyGroupsCard from "../../components/social/MyGroupsCard";

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
};

type ProfileWithAvatar = {
  username?: string | null;
  avatar_id?: string | null;
};

const emptyStats: ProfileStats = {
  general: { games_played: 0, wins: 0 },
  games: {},
  streak: 0,
  puzzles: null,
  perfectReallyHard: null,
  chessElo: null,
};
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
  "shogi",
  "eat-it",
]);
const statTabs = [
  { id: "general", label: "General" },
  { id: "chess", label: "Chess" },
  { id: "chess3d", label: "Chess 3D" },
  { id: "schafkopf", label: "Schafkopfen" },
  { id: "watten", label: "Watten" },
  { id: "natura", label: "Natura" },
  { id: "atlas", label: "Atlas Arena" },
  { id: "medieval", label: "Medieval Kingdoms" },
  { id: "go", label: "Go" },
  { id: "shogi", label: "Shogi" },
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
  const { user, profile, refreshProfile } = useAuth();

  const [username, setUsername] = useState("");
  const [avatarId, setAvatarId] = useState("m1");

  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [statTab, setStatTab] = useState<string>("general");

  const [editing, setEditing] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

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
      setUsername(currentName || "");
      setAvatarId(typedProfile?.avatar_id ?? "m1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile, user?.email]);

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
    if (!user) {
      return;
    }
    const userId = user.id;

    async function loadStats() {
      setLoadingStats(true);

      const [result, activity, puzzles, rating] = await Promise.all([
        supabase.rpc("get_my_game_stats"),
        supabase.rpc("get_dashboard_activity"),
        supabase.rpc("get_my_chess_puzzle_stats"),
        supabase
          .from("chess_ratings")
          .select("rating")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
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
          chessElo: rating.data?.rating ?? null,
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
  }, [user]);

  const totalGames = stats.general.games_played;
  const mostPlayed = Object.entries(stats.games)
    .filter(([, value]) => value.games_played > 0)
    .sort((a, b) => b[1].games_played - a[1].games_played)
    .slice(0, 3);
  const gameName = (id: string) =>
    statTabs.find((tab) => tab.id === id)?.label ?? id;

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

    const { error: avatarError } = await supabase
      .from("profiles")
      .update({
        avatar_id: nextAvatarId,
      })
      .eq("id", user.id);

    setSavingAvatar(false);

    if (avatarError) {
      setAvatarId(previousAvatar);
      setError(avatarError.message);
      return;
    }

    await refreshProfile();
    setMessage(ui("Avatar saved."));

    window.setTimeout(() => {
      setMessage(null);
    }, 1800);
  }

  /* =========================================================
     NOT LOGGED IN
     ========================================================= */

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
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,.15),_transparent_52%)] px-4 py-5 text-white sm:px-6 lg:h-[var(--app-height)] lg:min-h-0 lg:overflow-hidden lg:py-3">
      <div className="mx-auto max-w-6xl lg:flex lg:h-full lg:min-h-0 lg:flex-col">
        {/* HEADER */}

        <div className="mb-3 rounded-[28px] border border-indigo-300/10 bg-[#0b1529]/70 px-6 py-4 shadow-xl shadow-black/10 lg:shrink-0">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-300">
            {ui("Account")}
          </p>

          <h1 className="mt-1 text-3xl font-black">{ui("Your profile")}</h1>

          <p className="mt-2 text-sm text-slate-400">
            {ui("Manage your player name, avatar and game statistics.")}
          </p>
        </div>

        <div className="grid min-h-0 gap-4 lg:flex-1 lg:grid-cols-[250px_minmax(0,1fr)]">
          {/* =================================================
              LEFT PROFILE CARD
              ================================================= */}

          <aside className="min-h-0 lg:overflow-y-auto">
            <div className="rounded-[26px] border border-indigo-300/15 bg-[#0b1529]/90 p-5 shadow-2xl shadow-black/30">
              {/* AVATAR */}

              <div>
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

              <div className="mt-5">
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
              <div className="rounded-[30px] border border-amber-400/15 bg-zinc-900/80 p-6 shadow-xl shadow-black/20">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                      Avatar
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      {ui("Choose avatar")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {ui("Choose one of 12 characters.")}
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

                <ProfileAvatarPicker
                  selected={avatarId}
                  onSelect={(nextAvatarId) => {
                    void chooseAvatar(nextAvatarId);
                  }}
                />
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
