import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

import ProfileAvatarPicker, {
  ProfileAvatar,
} from "../../components/social/ProfileAvatarPicker";

type ProfileStats = {
  savedChessGames: number;
  classicMultiplayer: number;
  variantMultiplayer: number;
  wattenMultiplayer: number;
};

type ProfileWithAvatar = {
  username?: string | null;
  avatar_id?: string | null;
};

const emptyStats: ProfileStats = {
  savedChessGames: 0,
  classicMultiplayer: 0,
  variantMultiplayer: 0,
  wattenMultiplayer: 0,
};

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
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>

        <span className="text-2xl font-black text-amber-300">{value}</span>
      </div>

      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile } = useAuth();

  const [username, setUsername] = useState("");
  const [avatarId, setAvatarId] = useState("m1");

  const [stats, setStats] = useState<ProfileStats>(emptyStats);

  const [editing, setEditing] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);

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

    setUsername(currentName || user?.email?.split("@")[0]?.trim() || "Player");

    setAvatarId(typedProfile?.avatar_id ?? "m1");
  }, [profile, user?.email]);

  /* =========================================================
     MEMBER SINCE
     ========================================================= */

  const memberSince = useMemo(() => {
    if (!user?.created_at) {
      return "—";
    }

    return new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(user.created_at));
  }, [user?.created_at]);

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

      const [savedResult, classicResult, variantResult, wattenResult] =
        await Promise.all([
          supabase
            .from("games")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("user_id", userId),

          supabase
            .from("chess_room_players")
            .select("room_id", {
              count: "exact",
              head: true,
            })
            .eq("user_id", userId),

          supabase
            .from("variant_room_players")
            .select("room_id", {
              count: "exact",
              head: true,
            })
            .eq("user_id", userId),

          supabase
            .from("watten_room_players")
            .select("room_id", {
              count: "exact",
              head: true,
            })
            .eq("user_id", userId),
        ]);

      setStats({
        savedChessGames: savedResult.count ?? 0,
        classicMultiplayer: classicResult.count ?? 0,
        variantMultiplayer: variantResult.count ?? 0,
        wattenMultiplayer: wattenResult.count ?? 0,
      });

      setLoadingStats(false);
    }

    void loadStats();
  }, [user]);

  const totalGames =
    stats.savedChessGames +
    stats.classicMultiplayer +
    stats.variantMultiplayer +
    stats.wattenMultiplayer;

  /* =========================================================
     USERNAME
     ========================================================= */

  async function saveUsername() {
    if (!user) {
      return;
    }

    const nextName = username.trim();

    if (nextName.length < 2) {
      setError("Der Name muss mindestens 2 Zeichen lang sein.");
      return;
    }

    if (nextName.length > 30) {
      setError("Der Name darf maximal 30 Zeichen lang sein.");
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

    setUsername(nextName);
    setEditing(false);
    setMessage("Name gespeichert.");

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

    setMessage("Avatar gespeichert.");

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

          <h1 className="mt-5 text-2xl font-black">Nicht angemeldet</h1>

          <p className="mt-2 text-sm text-zinc-500">
            Melde dich an, um dein Profil zu sehen.
          </p>
        </div>
      </main>
    );
  }

  /* =========================================================
     PAGE
     ========================================================= */

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}

        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-400">
            Account
          </p>

          <h1 className="mt-2 text-4xl font-black">Dein Profil</h1>

          <p className="mt-2 text-sm text-zinc-500">
            Verwalte deinen Spielernamen, deinen Avatar und deine
            Spielstatistiken.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* =================================================
              LEFT PROFILE CARD
              ================================================= */}

          <aside>
            <div className="rounded-[30px] border border-white/10 bg-zinc-900/80 p-6 shadow-2xl shadow-black/30">
              {/* AVATAR */}

              <div>
                <button
                  type="button"
                  onClick={() => setAvatarPickerOpen((current) => !current)}
                  className="
                    group
                    relative
                    h-28
                    w-28
                    overflow-hidden
                    rounded-[30px]
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
                    className="h-full w-full rounded-[25px]"
                  />

                  <div
                    className="
                      absolute
                      inset-x-1
                      bottom-1
                      rounded-b-[23px]
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
                    Avatar ändern
                  </div>
                </button>

                {savingAvatar && (
                  <p className="mt-2 text-xs text-zinc-600">
                    Avatar wird gespeichert...
                  </p>
                )}
              </div>

              {/* NAME */}

              <div className="mt-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                  Spielername
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
                      Ändern
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
                        Abbrechen
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
                        {saving ? "Speichern..." : "Speichern"}
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
                  Mitglied seit
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

          <section className="space-y-6">
            {/* AVATAR PICKER */}

            {avatarPickerOpen && (
              <div className="rounded-[30px] border border-amber-400/15 bg-zinc-900/80 p-6 shadow-xl shadow-black/20">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                      Avatar
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      Avatar auswählen
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      Wähle einen von 12 Charakteren.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAvatarPickerOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  >
                    Schließen
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
                    Statistik
                  </p>

                  <h2 className="mt-1 text-2xl font-black">Deine Spiele</h2>
                </div>

                {loadingStats && (
                  <span className="text-xs text-zinc-600">Lade...</span>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  icon="🎮"
                  label="Spiele insgesamt"
                  value={loadingStats ? "…" : totalGames}
                />

                <StatCard
                  icon="♟"
                  label="Schach Multiplayer"
                  value={loadingStats ? "…" : stats.classicMultiplayer}
                />

                <StatCard
                  icon="⚡"
                  label="Schach Varianten"
                  value={loadingStats ? "…" : stats.variantMultiplayer}
                />

                <StatCard
                  icon="🃏"
                  label="Watten Multiplayer"
                  value={loadingStats ? "…" : stats.wattenMultiplayer}
                />

                <StatCard
                  icon="💾"
                  label="Gespeicherte Schachpartien"
                  value={loadingStats ? "…" : stats.savedChessGames}
                />

                <StatCard
                  icon="🏆"
                  label="Account Level"
                  value={
                    totalGames >= 100
                      ? "Veteran"
                      : totalGames >= 30
                        ? "Regular"
                        : totalGames >= 10
                          ? "Player"
                          : "Beginner"
                  }
                />
              </div>
            </div>

            {/* QUICK LINKS */}

            <div className="rounded-[30px] border border-white/10 bg-zinc-900/80 p-6">
              <h2 className="text-xl font-black">Weiterspielen</h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link
                  to="/games/chess"
                  className="
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/5
                    p-4
                    transition
                    hover:border-amber-400/25
                    hover:bg-amber-400/[0.06]
                  "
                >
                  <span className="text-2xl">♟</span>

                  <p className="mt-3 font-black">Schach</p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Klassisch, Varianten oder Multiplayer
                  </p>
                </Link>

                <Link
                  to="/games/watten"
                  className="
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/5
                    p-4
                    transition
                    hover:border-emerald-400/25
                    hover:bg-emerald-400/[0.06]
                  "
                >
                  <span className="text-2xl">🃏</span>

                  <p className="mt-3 font-black">Watten</p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Bayerisches Kartenspiel
                  </p>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
