import { useCallback, useEffect, useRef } from "react";
import { penaltyPower, type PenaltyView } from "../../../../games/party/minigames/expansionGames/penaltyShootout.ts";
import { COLORS } from "../../../../games/party/config.ts";
import { CharacterFace } from "../CharacterFace.tsx";
import type { MinigameViewProps } from "./views.ts";

const LANES = ["Left", "Middle", "Right"];
export default function PenaltyShootoutScreen({ match, minigame, playerId, online, now, sendInput }: MinigameViewProps) {
  const s = minigame.state as PenaltyView;
  const shooter = match.players.find((p) => p.id === s.shooterId)!, keeper = match.players.find((p) => p.id === s.keeperId)!;
  const shooting = s.shooterId === playerId, keeping = s.keeperId === playerId;
  const active = online && now < s.phaseEndsAt && s.phase === "aim" && (shooting && !s.shotLocked || keeping && !s.keeperLocked);
  const choice = s.yourLane ?? 1;
  const pick = useCallback((lane: number, kick = false) => { if (active) sendInput({ type: "PENALTY_CHOICE", attempt: s.attempt, lane, action: keeping ? "dive" : kick ? "kick" : "aim" }); }, [active, keeping, s.attempt, sendInput]);
  const handler = useRef({ pick, choice, shooting });
  useEffect(() => { handler.current = { pick, choice, shooting }; }, [pick, choice, shooting]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; if (/^[1-3]$/.test(e.key)) { e.preventDefault(); handler.current.pick(Number(e.key) - 1); } else if (e.code === "Space" && handler.current.shooting) { e.preventDefault(); handler.current.pick(handler.current.choice, true); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  const flight = s.phase === "flight" ? Math.min(1, Math.max(0, (now - s.phaseStartedAt) / 800)) : s.phase === "result" || s.phase === "finished" ? 1 : 0;
  const shotX = s.shot?.onTarget ? 30 + (s.shot?.lane ?? 1) * 20 : 9;
  const ballX = 50 + (shotX - 50) * flight, ballY = 79 - (s.shot?.onTarget ? 50 : 68) * flight;
  const keeperX = s.phase === "aim" ? 50 : 30 + (s.keeper?.lane ?? 1) * 20;
  const cue = s.phase === "aim" ? shooting ? s.shotLocked ? "KICK LOCKED · your shot stays secret" : "YOU SHOOT · choose a lane, then kick in the green zone" : keeping ? s.keeperLocked ? "DIVE LOCKED · your choice stays secret" : "YOU KEEP · lock your dive with 1 / 2 / 3" : `${shooter.name} shoots · ${keeper.name} keeps · watch for your next turn` : s.phase === "flight" ? "HERE COMES THE SHOT!" : s.outcome === "goal" ? `GOAL! ${shooter.name} +1` : s.outcome === "save" ? `SAVED! ${keeper.name} +1` : "MISSED · neither player scores";
  const power = penaltyPower(now, s.phaseStartedAt);
  return <div className="pp-arcade-game pp-penalty-game new-minigame"><header className="pp-arcade-header"><div><span className="pp-eyebrow">PENALTY {s.attempt}/12 · THREE SHOTS + THREE KEEPER TURNS EACH</span><h2>Pluto Penalties</h2></div><strong>{Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000))}s</strong></header>
    <div className="pp-arcade-objective" role="status">{cue}</div>
    <svg className="pp-arcade-world pp-penalty-pitch" viewBox="0 0 100 100" role="img" aria-label={`${shooter.name} taking a penalty against ${keeper.name}. ${s.outcome ?? "Choices hidden until the kick"}.`}>
      <rect width="100" height="100" fill="#182b43"/>{[0, 1, 2].map((n) => <g key={n}><path d={`M5 ${5 + n * 5}H95`} stroke="#567388" strokeWidth="2" strokeDasharray="1 2"/></g>)}
      <path d="M0 42H100V100H0Z" fill="#356f61"/>{[0, 1, 2, 3].map((n) => <path key={n} d={`M0 ${47 + n * 14}H100`} stroke="#447f6a" strokeWidth="7"/>)}
      <path d="M12 19H88V43H12Z" fill="#d4e5e72a" stroke="#e1f1f5" strokeWidth="1.6"/>{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${14 + i * 6.5} 20V42`} stroke="#b2d3df" strokeWidth=".35" opacity=".6"/>)}{[24, 29, 34, 39].map((y) => <path key={y} d={`M13 ${y}H87`} stroke="#b2d3df" strokeWidth=".35" opacity=".6"/>)}
      <path d="M20 43V71H80V43M35 71Q50 87 65 71" fill="none" stroke="#c5ded5" strokeWidth=".5"/>
      {[30, 50, 70].map((x, i) => <g key={i}><rect x={x - 9} y="23" width="18" height="16" rx="2" fill={s.phase === "aim" && (shooting || keeping) && choice === i ? `${COLORS[(shooting ? shooter : keeper).avatarId]}55` : "#a2c5d414"}/><text x={x} y="17" textAnchor="middle" fontSize="3.2" fill="#e5f1ff">{LANES[i].toUpperCase()}</text></g>)}
      <g transform={`translate(${keeperX} 38)`}><path d="M-5 0H5M0 0V7M0 7 -3 11M0 7 3 11" stroke={COLORS[keeper.avatarId]} strokeWidth="2.4" strokeLinecap="round"/><svg x="-3.5" y="-9" width="7" height="8" viewBox="0 0 64 72"><CharacterFace avatarId={keeper.avatarId}/></svg></g>
      <g transform="translate(50 86)"><path d="M-4 0H4M0 0V6M0 6 -3 10M0 6 3 10" stroke={COLORS[shooter.avatarId]} strokeWidth="2.5" strokeLinecap="round"/><svg x="-3.5" y="-9" width="7" height="8" viewBox="0 0 64 72"><CharacterFace avatarId={shooter.avatarId}/></svg></g>
      <circle cx={ballX} cy={ballY} r={2.1 - flight * .5} fill="#fff6dd" stroke="#263c4f" strokeWidth=".4"/><path d={`M${ballX - .7} ${ballY - .6}l1.2 -.1 .5 1.1 -.9 .7 -1 -.7Z`} fill="#304659"/>
      <text x="6" y="97" fill="#ecf8ed" fontSize="2.8">{shooter.name}: SHOOTER</text><text x="94" y="97" textAnchor="end" fill="#ecf8ed" fontSize="2.8">{keeper.name}: KEEPER</text>
    </svg>
    <div className="pp-penalty-buttons">{LANES.map((lane, i) => <button key={lane} type="button" disabled={!active} className={choice === i && (shooting || keeping) ? "selected" : ""} onClick={() => pick(i)}>{i + 1} · {lane}{keeping ? " dive" : ""}</button>)}</div>
    {shooting && s.phase === "aim" && <div className="pp-penalty-kick"><div><span>Power · kick while the marker is green</span><div className="pp-power-track" role="meter" aria-label="Shot power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(power * 100)}><i className="pp-power-good"/><i className="pp-power-marker" style={{ left: `${power * 100}%` }}/></div></div><button type="button" disabled={!active} onClick={() => pick(choice, true)}>Kick · Space</button></div>}
    <p className="pp-arcade-hint">Goal +1 · save +1 · miss +0 · hidden choices · equal turns for everyone</p>
    <div className="pp-arcade-scores">{match.players.map((p) => <div key={p.id} className={p.id === playerId ? "me" : ""}><i style={{ background: COLORS[p.avatarId] }}/><span>{p.name}<small>{s.players[p.id].goals} goals · {s.players[p.id].saves} saves</small></span><b>{s.players[p.id].score}</b></div>)}</div>
  </div>;
}
