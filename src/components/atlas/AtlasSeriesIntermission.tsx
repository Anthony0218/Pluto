import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { Check, Clock3 } from "lucide-react";

export function AtlasSeriesIntermission({ players, userId, ranked, endsAt, now, gameNumber, modeTitle, busy, onReady }: {
  players: { id: string; name: string; ready: boolean }[]; userId: string; ranked: boolean; endsAt?: string | null; now: number;
  gameNumber: number; modeTitle: string; busy: boolean; onReady: () => void;
}) {
  useGameLanguage();
  const me = players.find(player => player.id === userId);
  const seconds = endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)) : 45;
  return <section className="atlas-intermission" aria-label={gameUi("Next game")}>
    <span className="atlas-eyebrow">{gameUi("Up next · Game ")}{gameUi(gameNumber)}</span><h2>{gameUi(modeTitle)}</h2>
    {ranked ? <><p className="atlas-break-timer"><Clock3 aria-hidden />{gameUi(" Next game starts in ")}<strong>{gameUi(seconds)}s</strong></p><p>{gameUi("If both players click Ready, the next game starts immediately.")}</p></> : <p>{gameUi("The next game starts once both players press Continue.")}</p>}
    <p className="atlas-ready-count" role="status">{gameUi(players.filter(player => player.ready).length)}/{gameUi(players.length)}{gameUi(" are ready")}</p>
    <div className="atlas-continue-players">{players.map(player => <span key={player.id} className={player.ready ? "is-ready" : ""}><Check size={14} aria-hidden /> {player.name} · {gameUi(player.ready ? "Ready" : "Waiting")}</span>)}</div>
    <button type="button" className="atlas-start" disabled={busy || !me || me.ready} onClick={onReady}>{gameUi(me?.ready ? "Waiting for opponent…" : ranked ? "Ready" : "Continue")}</button>
  </section>;
}
