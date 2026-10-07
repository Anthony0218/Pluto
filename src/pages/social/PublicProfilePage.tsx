import GoRankedProfile from "@/components/ranked/GoRankedProfile";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Gamepad2, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import { featuredGames } from "@/data/dashboard";
import RankEmblem from "@/components/chess/RankEmblem";
import { getChessRank } from "@/games/chess/ranked/tiers";
import { isTimeControl, timeControlLabel, type TimeControl } from "@/games/chess/ranked/timeControls";
import { ProfileAvatar } from "@/components/social/ProfileAvatarPicker";
import { avatarFrameFor, avatarFrameStyle } from "@/components/social/avatarFrame";
import ProfilePage from "./ProfilePage";

type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_id: string | null;
  most_played: string[] | null;
  chess_rating: { rating: number; time_control: string } | null;
  /** Activity level; absent until the database function that reports it is deployed. */
  level?: number | null;
};

const gameNames: Record<string, string> = {
  chess: "Chess",
  schafkopf: "Schafkopfen",
  watten: "Watten",
  atlas: "Atlas Arena",
  go: "Go",
  shogi: "Shogi",
  "eat-it": "Eat It",
  natura: "Natura",
};

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; profile: PublicProfile };

async function resolveUserId(userId?: string, username?: string) {
  if (userId) return userId;
  if (!username) return null;
  const { data, error } = await supabase.rpc("find_profile_by_username", { p_username: username });
  if (!error) return (data as string | null) ?? null;
  // Before the social migration: exact, case-insensitive username match.
  const escaped = username.replace(/[\\%_]/g, (char) => `\\${char}`);
  const fallback = await supabase.from("profiles").select("id").ilike("username", escaped).limit(1).maybeSingle();
  return (fallback.data?.id as string | undefined) ?? null;
}

async function loadPublicProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { p_user_id: id });
  if (!error) return (data as PublicProfile | null) ?? null;
  const [profile, ratings] = await Promise.all([
    supabase.from("profiles").select("id,username,display_name,avatar_id").eq("id", id).maybeSingle(),
    supabase.from("chess_ratings").select("time_control,rating,rated_games").eq("user_id", id),
  ]);
  if (!profile.data) return null;
  const best = ((ratings.data ?? []) as { time_control: string; rating: number; rated_games: number }[])
    .filter((row) => row.rated_games > 0)
    .sort((a, b) => b.rating - a.rating)[0];
  return { ...(profile.data as Omit<PublicProfile, "most_played" | "chess_rating">), most_played: null, chess_rating: best ? { rating: best.rating, time_control: best.time_control } : null };
}

/** Another player's profile: name, avatar, most played games and rank. No e-mail, no detailed statistics. */
export default function PublicProfilePage() {
  useUiLanguage();
  const { userId, username } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [resolvedId, setResolvedId] = useState<string | null | undefined>(userId);
  const [state, setState] = useState<State>({ status: "loading" });
  const key = `${userId ?? ""}|${username ?? ""}`;
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setResolvedId(userId);
    setState({ status: "loading" });
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    void resolveUserId(userId, username).then(async (id) => {
      if (!active) return;
      setResolvedId(id);
      if (!id) { setState({ status: "missing" }); return; }
      if (id === user.id) return;
      const profile = await loadPublicProfile(id);
      if (active) setState(profile ? { status: "ready", profile } : { status: "missing" });
    });
    return () => { active = false; };
  }, [user, userId, username]);

  if (user && resolvedId === user.id) return <ProfilePage />;

  if (!user) {
    return <main className="mx-auto max-w-xl px-4 py-16 text-center text-white">
      <h1 className="text-2xl font-black">{ui("Player profile")}</h1>
      <p className="mt-2 text-sm text-zinc-400">{authLoading ? ui("Loading...") : ui("Sign in to view player profiles.")}</p>
      {!authLoading && <Link to="/login" className="mt-5 inline-block text-amber-300 underline">{ui("Log in")}</Link>}
    </main>;
  }

  if (state.status !== "ready") {
    return <main className="mx-auto max-w-xl px-4 py-16 text-center text-white">
      {state.status === "loading" ? <p className="text-sm text-zinc-400" role="status">{ui("Loading profile…")}</p> : <>
        <h1 className="text-2xl font-black">{ui("Player not found")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{username ? `${ui("No player is called")} “${username}”.` : ui("This player does not exist.")}</p>
      </>}
      <button type="button" onClick={() => window.history.back()} className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={15} />{ui("Back")}</button>
    </main>;
  }

  const { profile } = state;
  const name = profile.username || profile.display_name || ui("Player");
  const rating = profile.chess_rating;
  const tier = rating ? getChessRank(rating.rating) : null;
  const mode: TimeControl | null = rating && isTimeControl(rating.time_control) ? rating.time_control : null;
  const mostPlayed = profile.most_played ?? [];
  const frame = avatarFrameFor(profile.level ?? 1);

  return (
    <main className="min-h-[var(--app-height)] bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,.15),_transparent_52%)] px-3 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <button type="button" onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={15} />{ui("Back")}</button>

        <section className="relative overflow-hidden rounded-[28px] border border-indigo-300/25 bg-[#0b1529] shadow-2xl shadow-black/30">
          <img src={featuredGames[0]?.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071024] via-[#071024]/90 to-[#071024]/40 max-sm:bg-gradient-to-b" />
          <div className="relative flex flex-wrap items-center gap-5 px-5 py-7 sm:px-8">
            <span className={`h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#121d3d] p-1 ${frame ? "" : "border-2 border-indigo-300/70 shadow-[0_0_24px_rgba(129,140,248,.3)]"}`} style={avatarFrameStyle(frame, "#121d3d")} title={frame ? ui(`${frame.name} border`) : undefined}>
              <ProfileAvatar avatarId={profile.avatar_id ?? "m1"} className="h-full w-full rounded-xl" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[.28em] text-indigo-200">{ui("Pluto player profile")}</p>
              <h1 className="mt-1 break-words text-3xl font-black leading-tight sm:text-4xl">{name}</h1>
              {profile.display_name && profile.username && profile.display_name !== profile.username && <p className="mt-1 text-sm text-indigo-100/70">{profile.display_name}</p>}
              {profile.level != null && <p className="mt-1 text-xs font-semibold text-indigo-100/80">{ui("Activity level")} {profile.level}{frame && <> · <span style={{ color: frame.color }}>{ui(`${frame.name} border`)}</span></>}</p>}
            </div>
          </div>
        </section>

        <GoRankedProfile userId={profile.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-[26px] border border-indigo-400/15 bg-[#0b1529]/90 p-5 shadow-xl shadow-black/20">
            <h2 className="flex items-center gap-2 text-lg font-black"><Trophy size={19} className="text-amber-300" />{ui("Rank")}</h2>
            {tier ? <div className="mt-4 flex items-center gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/[.06] p-4">
              <RankEmblem family={tier.family} size="lg" />
              <div><strong className="block text-lg text-amber-100">{ui(tier.name)}</strong><span className="text-xs text-zinc-400">{ui("Ranked chess")}{mode ? ` · ${timeControlLabel(mode, ui)}` : ""}</span></div>
            </div> : <p className="mt-4 text-sm text-slate-400">{ui("Unranked")}</p>}
          </section>

          <section className="rounded-[26px] border border-indigo-400/15 bg-[#0b1529]/90 p-5 shadow-xl shadow-black/20">
            <h2 className="flex items-center gap-2 text-lg font-black"><Gamepad2 size={19} className="text-violet-300" />{ui("Most Played Games")}</h2>
            {mostPlayed.length ? <ol className="mt-4 grid gap-2">
              {mostPlayed.map((game, index) => <li key={game} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><span className="text-amber-300">{index + 1}.</span> {ui(gameNames[game] ?? game)}</li>)}
            </ol> : <p className="mt-4 text-sm text-slate-400">{ui(profile.most_played === null ? "Not available yet." : "No completed games yet.")}</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
