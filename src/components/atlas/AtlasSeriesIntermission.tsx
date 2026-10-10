import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { Check } from "lucide-react";

export function AtlasSeriesIntermission({ players, userId, gameNumber, modeTitle, busy, onReady }: {
  players: { id: string; name: string; ready: boolean }[]; userId: string; ranked: boolean; endsAt?: string | null; now: number;
  gameNumber: number; modeTitle: string; busy: boolean; onReady: () => void;
}) {
  useGameLanguage();
  const me = players.find(player => player.id === userId);
  return <section className="atlas-intermission" aria-label={gameUi("Next game")}>
    <span className="atlas-eyebrow">{gameUi("Up next · Game ")}{gameUi(gameNumber)}</span><h2>{gameUi(modeTitle)}</h2>
    <p>The next game starts once {players.length > 2 ? "all" : "both"} players press I'm ready.</p>
    <p className="atlas-ready-count" role="status">{gameUi(players.filter(player => player.ready).length)}/{gameUi(players.length)}{gameUi(" are ready")}</p>
    <div className="atlas-continue-players">{players.map(player => <span key={player.id} className={player.ready ? "is-ready" : ""}><Check size={14} aria-hidden /> {player.name} · {gameUi(player.ready ? "Ready" : "Waiting")}</span>)}</div>
    <button type="button" className="atlas-start" disabled={busy || !me || me.ready} onClick={onReady}>{me?.ready ? players.length > 2 ? "Waiting for the others…" : "Waiting for opponent…" : "I'm ready"}</button>
  </section>;
}
