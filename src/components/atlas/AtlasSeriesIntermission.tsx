import { Check, Clock3 } from "lucide-react";

export function AtlasSeriesIntermission({ players, userId, ranked, endsAt, now, gameNumber, modeTitle, busy, onReady }: {
  players: { id: string; name: string; ready: boolean }[]; userId: string; ranked: boolean; endsAt?: string | null; now: number;
  gameNumber: number; modeTitle: string; busy: boolean; onReady: () => void;
}) {
  const me = players.find(player => player.id === userId);
  const seconds = endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)) : 45;
  return <section className="atlas-intermission" aria-label="Next game">
    <span className="atlas-eyebrow">Up next · Game {gameNumber}</span><h2>{modeTitle}</h2>
    {ranked ? <><p className="atlas-break-timer"><Clock3 aria-hidden /> Next game starts in <strong>{seconds}s</strong></p><p>If both players click Ready, the next game starts immediately.</p></> : <p>The next game starts once both players press Continue.</p>}
    <p className="atlas-ready-count" role="status">{players.filter(player => player.ready).length}/{players.length} are ready</p>
    <div className="atlas-continue-players">{players.map(player => <span key={player.id} className={player.ready ? "is-ready" : ""}><Check size={14} aria-hidden /> {player.name} · {player.ready ? "Ready" : "Waiting"}</span>)}</div>
    <button type="button" className="atlas-start" disabled={busy || !me || me.ready} onClick={onReady}>{me?.ready ? "Waiting for opponent…" : ranked ? "Ready" : "Continue"}</button>
  </section>;
}
