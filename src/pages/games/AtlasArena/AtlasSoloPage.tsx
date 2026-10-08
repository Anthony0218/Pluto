import { useRandomSeries } from "./useRandomSeries";
import { AtlasRandomSeriesProgress, AtlasRandomSeriesResults } from "../../../components/atlas/AtlasRandomSeriesResults";
import { TrialSessionContext } from "../../../components/atlas/trials/trialSession";
import { useCallback, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Globe2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { AtlasSoloGame, SoloResults, SoloSettingsForm } from "../../../components/atlas/AtlasSoloGame";
import { TRIAL_GAMES, useTrialPools } from "../../../components/atlas/trials/trialRegistry";
import { bestKey, freshSeed } from "../../../games/atlas/arenaStorage";
import { type ArenaModeDef } from "../../../games/atlas/modeCatalog";
import { settingsReady, type SoloSummary } from "../../../games/atlas/soloSettings";
import type { AtlasDataset } from "../../../games/atlas/types";
import { useAtlasData } from "../../../games/atlas/useAtlasData";
import { useArenaStore } from "./useArenaStore";
import "./atlas-arena.css";
import "../../../components/atlas/trials/atlas-trials.css";

export function AtlasLoading() { return <main className="atlas-page atlas-center"><div className="atlas-orbit is-loading"><Globe2 /></div><h1>Preparing the world…</h1><p>Loading the versioned Atlas snapshot.</p></main>; }
export function AtlasUnavailable({ error }: { error?: string | null }) { return <main className="atlas-page atlas-center"><Globe2 size={44} /><h1>Atlas data unavailable</h1><p>{error}</p><Link to="/games/atlas-arena">Back to Atlas Arena</Link></main>; }

/** Singleplayer for every mode: the stat modes start straight away, the map modes ask for their settings first. */
export default function AtlasSoloPage() {
  const { modeId } = useParams();
  const [params] = useSearchParams();
  const key = params.get("random") === "1" ? `series:${params.get("series") ?? params.get("bestOf")}` : `single:${modeId}`;
  return <SoloSession key={key} modeId={modeId} />;
}

function SoloSession({ modeId }: { modeId?: string }) {
  const series = useRandomSeries(modeId, true);
  const mode = series.mode;
  const { data, loading, error } = useAtlasData();
  if (!mode) return <Navigate to="/games/atlas-arena" replace />;
  if (loading) return <AtlasLoading />;
  if (error || !data) return <AtlasUnavailable error={error} />;
  if (series.enabled && series.reviewing) return <AtlasRandomSeriesResults key={series.results.length} {...series} solo players={[{ id: "you", name: "You" }]} onNext={series.next} onAgain={series.reset} />;
  const onComplete = series.enabled ? (score: number) => series.finish({ you: score }) : undefined;
  const game = mode.solo.kind === "trial" ? <TrialSolo key={`${mode.id}:${series.results.length}`} mode={mode} data={data} onComplete={onComplete} /> : <ArenaSolo key={`${mode.id}:${series.results.length}`} mode={mode} data={data} onComplete={onComplete} />;
  return series.enabled ? <div className="atlas-series-session"><AtlasRandomSeriesProgress length={series.length} index={series.results.length} />{game}</div> : game;
}

function TrialSolo({ mode, data, onComplete }: { mode: ArenaModeDef; data: AtlasDataset; onComplete?: (score: number) => void }) {
  const navigate = useNavigate();
  const { stored, recordBest } = useArenaStore();
  const [seed, setSeed] = useState(freshSeed);
  const { difficulty } = stored;
  const pools = useTrialPools(data, difficulty);
  const record = useCallback((score: number) => { recordBest(mode.bestId, difficulty, score); }, [difficulty, mode.bestId, recordBest]);
  const exit = useCallback(() => navigate("/games/atlas-arena"), [navigate]);
  const restart = useCallback(() => setSeed(freshSeed()), []);
  if (mode.solo.kind !== "trial" || !pools) return null;
  const { component: Game, fullPool } = TRIAL_GAMES[mode.solo.trial];
  return <TrialSessionContext.Provider value={onComplete ? { onComplete } : null}><Game key={`${difficulty}:${seed}`} pool={fullPool ? pools.full : pools.difficulty} byId={pools.byId} topology={data.topology} history={data.history} seed={seed} difficulty={difficulty} best={stored.best[bestKey(mode.bestId, difficulty)] ?? 0} onRecord={record} onRestart={restart} onExit={exit} /></TrialSessionContext.Provider>;
}

function ArenaSolo({ mode, data, onComplete }: { mode: ArenaModeDef; data: AtlasDataset; onComplete?: (score: number) => void }) {
  const navigate = useNavigate();
  const { stored, update, recordBest } = useArenaStore();
  const [phase, setPhase] = useState<"setup" | "playing" | "result">(mode.options.length ? "setup" : "playing");
  const [seed, setSeed] = useState(freshSeed);
  const [summary, setSummary] = useState<SoloSummary | null>(null);
  const settings = stored.settings;
  const finish = useCallback((result: SoloSummary) => {
    setSummary(result); setPhase("result");
    recordBest(mode.bestId, settings.difficulty, result.score, mode.id==="map-fill"?settings.scope:undefined);
    onComplete?.(result.score);
  }, [mode.bestId, mode.id, onComplete, recordBest, settings.difficulty, settings.scope]);
  const start = () => { setSeed(freshSeed()); setSummary(null); setPhase("playing"); };
  const toHub = () => navigate("/games/atlas-arena");
  if (mode.solo.kind !== "arena") return null;

  if (phase === "setup") return (
    <main className="atlas-page atlas-setup">
      <Link className="atlas-back" to="/games/atlas-arena"><ArrowLeft /> Atlas Arena</Link>
      <div className="atlas-setup-card">
        <span className="atlas-eyebrow">Singleplayer · configure</span>
        <h1>{mode.title}</h1>
        <p>{mode.description}</p>
        <SoloSettingsForm mode={mode} settings={settings} onChange={(next) => update({ settings: next })} />
        <button type="button" className="atlas-start" disabled={!settingsReady(mode, settings)} onClick={start}>Start <ChevronRight /></button>
      </div>
    </main>
  );
  if (phase === "result" && summary) return <SoloResults mode={mode.solo.mode} summary={summary} entities={data.countries} actions={<>
    {onComplete ? <button type="button" onClick={() => onComplete(summary.score)}>See series score <ChevronRight /></button> : <button type="button" onClick={start}><RotateCcw /> Replay</button>}
    {mode.options.length > 0 && <button type="button" className="atlas-secondary" onClick={() => setPhase("setup")}><SlidersHorizontal /> Settings</button>}
    <button type="button" className="atlas-secondary" onClick={toHub}>Back to menu</button>
  </>} />;
  return <AtlasSoloGame key={seed} data={data} mode={mode.solo.mode} settings={settings} seed={seed} title={mode.title} onFinish={finish} onExit={() => mode.options.length ? setPhase("setup") : toHub()} />;
}
