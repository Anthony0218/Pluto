import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Trophy } from "lucide-react";
import RankEmblem from "@/components/chess/RankEmblem";
import { useAuth } from "@/context/AuthContext";
import { games } from "@/data/games";
import { getRankFromProfile, rankedModes } from "@/games/atlas/ranked";
import { goTimeControls, isGoTimeControl, GO_RANKED_DEFAULT_MODE, type GoTimeControl } from "@/games/go/ranked/config";
import { useGoRankedProfile } from "@/games/go/ranked/profile";
import { getChessRank, type RankFamily } from "@/games/chess/ranked/tiers";
import { isTimeControl, timeControls, type TimeControl } from "@/games/chess/ranked/timeControls";
import { ui, useUiLanguage } from "@/i18n/ui";
import { supabase } from "@/lib/supabase";
import "./competitive.css";

const CHESS_KEY = "chess-ranked-time-control";
const GO_KEY = "go-ranked-time-control";
const imageOf = (route: string) => games.find(game => game.route === route)?.image;

/** The ranked lobbies read the same keys, so the clock picked here is the one they open with. */
function useStoredChoice<T extends string>(key: string, isValid: (value: unknown) => value is T, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try { const stored = localStorage.getItem(key); return isValid(stored) ? stored : fallback; } catch { return fallback; }
  });
  const choose = (next: T) => {
    setValue(next);
    try { localStorage.setItem(key, next); } catch { /* The lobby falls back to its default clock. */ }
  };
  return [value, choose] as const;
}

type Rating = { family: RankFamily; name: string; value: number; detail: string };

function RankedCard({ title, tag, image, eyebrow, rating, signedIn, optionsLabel, options, to, links }: {
  title: string; tag: string; image?: string; eyebrow: string; rating: Rating | null; signedIn: boolean; optionsLabel: string;
  options: React.ReactNode; to: string; links: React.ReactNode;
}) {
  return <article className="competitive-card">
    <div className="competitive-banner">{image && <img src={image} alt="" />}<span className="competitive-tag">{ui(tag)}</span><h2>{ui(title)}</h2></div>
    <div className="competitive-elo">
      {rating ? <RankEmblem family={rating.family} /> : <span className="competitive-elo-empty"><Trophy size={22} aria-hidden /></span>}
      <div><small>{ui(eyebrow)}</small>{rating ? <b>{rating.value}<em>{ui(rating.name)}{rating.detail && ` · ${ui(rating.detail)}`}</em></b> : <b>—<em>{ui(signedIn ? "Loading…" : "Log in to see your rating")}</em></b>}</div>
    </div>
    <div className="competitive-body">
      <p className="competitive-label">{ui(optionsLabel)}</p>
      {options}
      <div className="competitive-links">{links}</div>
      <Link to={to} className="competitive-play">{ui("Play ranked")}<ArrowRight size={16} aria-hidden /></Link>
    </div>
  </article>;
}

function Chips<T extends string>({ items, value, onChange, label, columns }: { items: { id: T; name: string; clock: string }[]; value: T; onChange: (next: T) => void; label: string; columns: number }) {
  return <div role="radiogroup" aria-label={ui(label)} className="competitive-chips" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
    {items.map(item => <button key={item.id} type="button" role="radio" aria-checked={value === item.id} className={value === item.id ? "on" : undefined} onClick={() => onChange(item.id)}>{ui(item.name)}<small>{item.clock}</small></button>)}
  </div>;
}

function LeaderboardLink() {
  return <Link to="/leaderboards" className="competitive-link">{ui("Leaderboards")}<ArrowRight size={13} aria-hidden /></Link>;
}

/** The card stays as tall as its neighbours, so only the first few of the ranked modes are named. */
const shownModes = 5;

type AtlasProfile = { rating: number; deviation: number; matches_played: number };

export default function CompetitivePage() {
  useUiLanguage();
  const { user } = useAuth();
  const [chessControl, setChessControl] = useStoredChoice<TimeControl>(CHESS_KEY, isTimeControl, "rapid");
  const [goControl, setGoControl] = useStoredChoice<GoTimeControl>(GO_KEY, isGoTimeControl, GO_RANKED_DEFAULT_MODE);
  const [chessRatings, setChessRatings] = useState<Partial<Record<TimeControl, number>> | null>(null);
  const [atlas, setAtlas] = useState<AtlasProfile | null>(null);
  const goRatings = useGoRankedProfile(user?.id);
  useEffect(() => {
    if (!user) return;
    let live = true;
    void Promise.resolve(supabase.from("chess_ratings").select("time_control,rating").eq("user_id", user.id)).then(result => {
      if (!live) return;
      const rows = (result.data ?? []) as { time_control: string; rating: number }[];
      setChessRatings(Object.fromEntries(rows.filter(row => isTimeControl(row.time_control)).map(row => [row.time_control, row.rating])));
    });
    void Promise.resolve(supabase.functions.invoke("atlas-match", { body: { op: "rankedProfile" } })).then(({ data, error }) => {
      if (live && !error && data && typeof data.rating === "number") setAtlas(data as AtlasProfile);
    });
    return () => { live = false; };
  }, [user]);
  // Everyone starts at 1200 Elo, so a mode that has no row yet is shown at the starting rating.
  const eloRating = (value: number): Rating => { const rank = getChessRank(value); return { family: rank.family, name: rank.name, value, detail: "" }; };
  const chess = user && chessRatings ? eloRating(chessRatings[chessControl] ?? 1200) : null;
  const go = user && goRatings.rows ? eloRating(goRatings.rows.find(row => row.time_control === goControl)?.rating ?? 1200) : null;
  const atlasRank = atlas ? getRankFromProfile(atlas) : null;
  const atlasRating: Rating | null = atlas && atlasRank ? { family: atlasRank.tier, name: atlasRank.displayName, value: Math.round(atlas.rating), detail: atlasRank.provisional ? "Provisional" : "" } : null;
  const label = (list: { id: string; name: string }[], id: string) => ui(list.find(item => item.id === id)?.name ?? id);
  return <main className="competitive-page">
    <Link to="/home" className="competitive-back">← {ui("Home")}</Link>
    <p className="competitive-eyebrow">{ui("Competitive")}</p>
    <h1>{ui("Play competitive")}</h1>
    <p className="competitive-sub">{ui("Pick a game, find an opponent near your rating and play a verified ranked match.")}</p>
    <div className="competitive-grid">
      <RankedCard title="Ranked Chess" tag="Elo · 4 modes" image={imageOf("/games/chess")} eyebrow={`${ui("Your Elo")} · ${label(timeControls, chessControl)}`} rating={chess} signedIn={!!user}
        optionsLabel="Time control" options={<Chips items={timeControls} value={chessControl} onChange={setChessControl} label="Time control" columns={4} />} to="/games/chess/ranked" links={<LeaderboardLink />} />
      <RankedCard title="Ranked Go" tag="Elo · byo-yomi" image={imageOf("/games/go")} eyebrow={`${ui("Your Elo")} · ${label(goTimeControls, goControl)}`} rating={go} signedIn={!!user}
        optionsLabel="Time control" options={<Chips items={goTimeControls} value={goControl} onChange={setGoControl} label="Time control" columns={2} />} to="/games/go/multiplayer?tab=ranked" links={<LeaderboardLink />} />
      <RankedCard title="Ranked Atlas Arena" tag="Best of three" image={imageOf("/games/atlas-arena")} eyebrow="Your rating" rating={atlasRating} signedIn={!!user}
        optionsLabel="Modes in ranked" options={<div className="competitive-modes">{rankedModes().slice(0, shownModes).map(mode => <span key={mode.id}>{ui(mode.title)}</span>)}{rankedModes().length > shownModes && <span className="more">+{rankedModes().length - shownModes} {ui("more")}</span>}</div>} to="/games/atlas-arena?tab=ranked" links={<LeaderboardLink />} />
    </div>
  </main>;
}
