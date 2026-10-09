import { useCallback, useEffect, useRef } from "react";
import { COLORS } from "../../../../games/party/config.ts";
import { minigameRegistry } from "../../../../games/party/minigames/index.ts";
import { HEIST_DOCKS, heistLaser, type HeistState } from "../../../../games/party/minigames/expansionGames/plutoHeist.ts";
import { KITCHEN_X, kitchenY, type KitchenState } from "../../../../games/party/minigames/expansionGames/kitchenChaos.ts";
import { ROCKET_ROCKS, type RocketState } from "../../../../games/party/minigames/expansionGames/rocketRumble.ts";
import { rallyPoint, RALLY_CELLS, RALLY_HAZARDS, type RallyState } from "../../../../games/party/minigames/expansionGames/orbitalRally.ts";
import type { DiscoState } from "../../../../games/party/minigames/expansionGames/discoFreeze.ts";
import type { Mover } from "../../../../games/party/minigames/festivalGames/common.ts";
import { CharacterFace } from "../CharacterFace.tsx";
import { partyAudio } from "../../../../games/party/client/audio.ts";
import type { MinigameViewProps } from "./views.ts";

const TEAM_COLORS = ["#8edaff", "#ffabce"];
function HoldControl({ controlKey, label, name, active, change }: { controlKey: string; label: string; name: string; active: boolean; change: (key: string, held: boolean) => void }) {
  return <button type="button" disabled={!active} aria-label={name} onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); change(controlKey, true); }} onPointerUp={() => change(controlKey, false)} onPointerCancel={() => change(controlKey, false)} onLostPointerCapture={() => change(controlKey, false)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); change(controlKey, true); } }} onKeyUp={(e) => { if (e.key === "Enter") change(controlKey, false); }}>{label}</button>;
}
function Stars() {
  return <><rect width="100" height="100" fill="#10152f"/>{Array.from({ length: 60 }, (_, i) => <circle key={i} cx={(i * 37 + 7) % 100} cy={(i * 61 + 13) % 100} r={i % 6 ? .18 : .45} fill={i % 3 ? "#b2c2ff" : "#f6d5ff"} opacity={.35 + i % 4 * .15}/>)}<circle cx="93" cy="7" r="12" fill="#534087"/><path d="M78 8q14 9 27 -6" fill="none" stroke="#a49adb" strokeWidth="2" opacity=".6"/></>;
}
function Pawns({ players, props, space = false }: { players: Record<string, Mover & { team?: number; cloakUntil?: number; cargo?: number; holding?: string | null }>; props: MinigameViewProps; space?: boolean }) {
  return <>{props.match.players.filter((p) => players[p.id]).map((p) => { const mover = players[p.id], color = mover.team === undefined ? COLORS[p.avatarId] : TEAM_COLORS[mover.team]; return <g key={p.id} transform={`translate(${mover.x} ${mover.y})`} opacity={(mover.cloakUntil ?? 0) > props.now ? .5 : 1}>
    <ellipse cy="3" rx="3.7" ry="1.6" fill="#070d20" opacity=".4"/><circle r={p.id === props.playerId ? 4.6 : 3.8} fill={space ? "#aad8ec33" : "none"} stroke={color} strokeWidth={p.id === props.playerId ? .8 : .45}/>
    <svg x="-2.8" y="-4.4" width="5.6" height="6.5" viewBox="0 0 64 72"><CharacterFace avatarId={p.avatarId}/></svg>
    {space && <path d="M-3 -2q3 -3 6 0" fill="none" stroke="#d7f6ff" strokeWidth=".55"/>}
    <text y="-6" textAnchor="middle" fontSize="2.7" fill="#fff" stroke="#10182e" strokeWidth=".45" paintOrder="stroke" fontWeight="800">{p.name}{p.id === props.playerId ? " ★" : ""}</text>
    {!!mover.cargo && <text y="7" textAnchor="middle" fontSize="3" fill="#ffe491">◆ {mover.cargo}</text>}
    {mover.holding && <text y="7" textAnchor="middle" fontSize="3" fill="#fff4b2">{mover.holding === "raw" ? "🥬" : mover.holding === "chopped" ? "🥗" : "🍲"}</text>}
  </g>; })}</>;
}
function DiscoScene({ s, props }: { s: DiscoState; props: MinigameViewProps }) {
  const freeze = s.phase === "freeze";
  return <><rect width="100" height="100" fill="#221630"/>{Array.from({ length: 100 }, (_, i) => <rect key={i} x={i % 10 * 10 + .5} y={Math.floor(i / 10) * 8 + 20} width="9" height="7" rx=".8" fill={freeze ? "#6e2d51" : ["#3a3d7e", "#406777", "#794a79", "#63633b"][(i + s.heat) % 4]} stroke={freeze ? "#ed7481" : "#ac92d5"} strokeWidth=".15"/>)}
    <path d="M15 0 40 80 60 80 85 0" fill={freeze ? "#ff5c7430" : "#bd8bff25"}/><rect x="30" y="3" width="40" height="13" rx="3" fill="#392251" stroke="#c895ef" strokeWidth=".7"/>
    <circle cx="50" cy="6" r="4" fill="#90dfbd"/><ellipse cx="48" cy="5.5" rx=".8" ry="1.2" fill="#19253a"/><ellipse cx="52" cy="5.5" rx=".8" ry="1.2" fill="#19253a"/>
    <circle cx="39" cy="12" r="3" fill="#171a31" stroke="#be92ef"/><circle cx="61" cy="12" r="3" fill="#171a31" stroke="#be92ef"/>
    <text x="50" y="18" textAnchor="middle" fill={freeze ? "#ffb2b8" : "#b2ffe0"} fontSize="4" fontWeight="900">{freeze ? "FREEZE!" : s.phase === "scratch" ? "SCRATCH! KEEP DANCING" : "DJ PLUTO · DANCE"}</text>
    <Pawns players={s.players} props={props}/>{props.match.players.map((p) => s.players[p.id]?.failed ? <text key={p.id} x={s.players[p.id].x} y={s.players[p.id].y + 8} textAnchor="middle" fill="#ffb9b9" fontSize="3">Oops! −2</text> : null)}
  </>;
}
function HeistScene({ s, props }: { s: HeistState; props: MinigameViewProps }) {
  const laser = heistLaser(s.simTime, s.startedAt), dx = Math.cos(laser.angle) * 33, dy = Math.sin(laser.angle) * 33;
  return <><Stars/><path d="M10 4H90L97 14V86L90 96H10L3 86V14Z" fill="#233345" stroke="#99b8cb" strokeWidth="1"/>
    <path d="M10 18H90M10 82H90M18 10V90M82 10V90" stroke="#486077" strokeWidth=".6"/>
    <circle cx="50" cy="50" r="34" fill="#1a2539" stroke="#779aaf" strokeWidth=".7"/><circle cx="50" cy="50" r="25" fill="none" stroke="#5a7f94" strokeDasharray="1 2"/>
    <rect x="37" y="5" width="26" height="9" rx="4" fill="#101a38" stroke="#839bae" strokeWidth=".5"/><circle cx="49" cy="9" r="3" fill="#b29abf"/><ellipse cx="49" cy="9" rx="6" ry=".8" fill="none" stroke="#ecc8eb" strokeWidth=".5"/>
    <text x="50" y="20" textAnchor="middle" fill="#beddf1" fontSize="3.3" letterSpacing=".5">PLUTO ORBITAL VAULT</text>
    {HEIST_DOCKS.map((dock, i) => { const player = props.match.players.find((p) => s.players[p.id]?.dock === i), color = COLORS[player?.avatarId ?? i]; return <g key={i} transform={`translate(${dock.x} ${dock.y})`}><rect x="-6" y="-6" width="12" height="12" rx="3" fill="#385465" stroke={color} strokeWidth=".9"/><path d="M-3 3V-2L0 -5 3 -2V3Z" fill="#dcebf5"/><circle cy="-1" r="1.4" fill="#1a3654"/><text y={i < 2 ? 9 : -8} textAnchor="middle" fill={color} fontSize="2.6">{i + 1} · SHUTTLE</text></g>; })}
    {s.gems.filter((g) => g.respawnAt <= props.now).map((gem) => <g key={gem.id} transform={`translate(${gem.x} ${gem.y})`}><path d="M0 -2.5 2 0 0 3 -2 0Z" fill={gem.value === 5 ? "#ffe58e" : gem.value === 3 ? "#c89eff" : "#c6f6ff"} stroke="#fff" strokeWidth=".4"/><text y="5" fontSize="2.4" textAnchor="middle" fill="#f4edff">{gem.value}</text></g>)}
    <g stroke={laser.active ? "#ff7781" : "#ffd887"} strokeWidth="3" opacity={laser.active ? .7 : .25}><path d={`M${50 - dx} ${50 - dy}L${50 + dx} ${50 + dy}`}/><path d={`M${50 + dy} ${50 - dx}L${50 - dy} ${50 + dx}`}/></g>
    <circle cx="50" cy="50" r="4.5" fill="#92cae3" stroke="#f9ecff"/><circle cx="50" cy="50" r="2" fill={laser.active ? "#f5697a" : "#ffce71"}/><Pawns players={s.players} props={props} space/>
  </>;
}
function KitchenScene({ s, props }: { s: KitchenState; props: MinigameViewProps }) {
  return <><rect width="100" height="100" fill="#192941"/>{s.teams.map((team, i) => { const y = kitchenY(i); return <g key={i}>
    <rect x="3" y={y - 19} width="94" height="38" rx="4" fill={i === 0 ? "#234d60" : "#57394e"} stroke={TEAM_COLORS[i]} strokeWidth=".6"/>
    <text x="50" y={y - 22} textAnchor="middle" fontSize="3.1" fill={TEAM_COLORS[i]} fontWeight="800">{team.ids.map((id) => props.match.players.find((p) => p.id === id)?.name).join(" + ")} · {team.served} SERVED</text>
    {Object.entries(KITCHEN_X).map(([name, x]) => <g key={name}><rect x={x - 7} y={y - 7} width="14" height="14" rx="2" fill="#eee3c9" stroke="#a59381" strokeWidth=".7"/><text x={x} y={y + 1.7} textAnchor="middle" fontSize="7">{name === "supply" ? "🥬" : name === "chop" ? "🔪" : name === "oven" ? "" : "🍽"}</text><text x={x} y={y + 13} textAnchor="middle" fontSize="2.5" fill="#fff4df">{name.toUpperCase()}</text></g>)}
    {team.pots.map((pot, n) => { const ready = pot && props.now >= pot.readyAt; return <g key={n} transform={`translate(63 ${y - 3.5 + n * 7})`}><rect x="-5" y="-2.5" width="10" height="5" rx="1" fill={pot ? ready ? pot.burnsAt - props.now < 1500 ? "#f39e72" : "#9fe0b3" : "#edc889" : "#3b4b5b"}/><text y="1" textAnchor="middle" fontSize="2.1" fill={pot ? "#22384a" : "#e1d7c6"}>{pot ? ready ? "READY" : "COOK…" : "EMPTY"}</text></g>; })}
    <text x="50" y={y + 19} textAnchor="middle" fontSize="2.5" fill="#d1e2ec">SPACE: TAKE → HOLD TO CHOP → COOK → SERVE</text>
  </g>; })}<Pawns players={s.players} props={props}/>{Object.entries(s.players).map(([id, p]) => p.chopProgress > 0 ? <g key={id}><rect x={p.x - 4} y={p.y + 6} width="8" height="1.2" rx=".5" fill="#171f30"/><rect x={p.x - 4} y={p.y + 6} width={Math.min(8, p.chopProgress / 1.2 * 8)} height="1.2" rx=".5" fill="#c9ffa9"/></g> : null)}</>;
}
function RocketScene({ s, props }: { s: RocketState; props: MinigameViewProps }) {
  return <><Stars/><rect x="3" y="3" width="94" height="94" rx="12" fill="none" stroke="#637baa" strokeDasharray="1 3"/>
    {ROCKET_ROCKS.map((r, i) => <g key={i}><circle cx={r.x} cy={r.y} r={r.r} fill="#626078" stroke="#9992ac" strokeWidth=".7"/><circle cx={r.x - r.r * .3} cy={r.y - r.r * .2} r={r.r * .3} fill="#45425b"/><circle cx={r.x + r.r * .3} cy={r.y + r.r * .4} r={r.r * .17} fill="#45425b"/></g>)}
    {s.fuel.filter((f) => f.respawnAt <= props.now).map((f) => <g key={f.id} transform={`translate(${f.x} ${f.y})`}><path d="M0 -2.6 .8 -1 2.6 -.8 1.3 .6 1.6 2.5 0 1.6 -1.6 2.5 -1.3 .6 -2.6 -.8 -.8 -1Z" fill={f.value === 3 ? "#ffdf85" : "#8fe9e4"}/><text y="5" textAnchor="middle" fontSize="2.5" fill="#f4e8ca">{f.value}</text></g>)}
    {props.match.players.map((p) => { const r = s.players[p.id]; if (!r) return null; return <g key={p.id} transform={`translate(${r.x} ${r.y})`}><g transform={`rotate(${r.heading * 180 / Math.PI + 90})`}>
      {Math.hypot(r.vx, r.vy) > 2 && <path d="M-1.1 3 0 7 1.1 3Z" fill={r.boostUntil > props.now ? "#b4e9ff" : "#f8bd74"}/>}
      <path d="M0 -4 2.2 -1 2.2 3 -2.2 3 -2.2 -1Z" fill={COLORS[p.avatarId]} stroke="#ecf5ff" strokeWidth=".4"/><path d="M-2 1 -3.8 4 -2 3M2 1 3.8 4 2 3" fill={COLORS[p.avatarId]}/><circle cy="-1" r="1.2" fill="#25405c"/>
      </g>{r.shieldUntil > props.now && <circle r="5" fill="none" stroke="#a6daff" strokeDasharray=".8 1" strokeWidth=".4"/>}<text y="-6" textAnchor="middle" fontSize="2.7" fill="#fff" stroke="#10182e" strokeWidth=".4" paintOrder="stroke">{p.name}{p.id === props.playerId ? " ★" : ""}</text></g>; })}
  </>;
}
function RallyScene({ s, props }: { s: RallyState; props: MinigameViewProps }) {
  return <><Stars/><ellipse cx="50" cy="50" rx="43" ry="33" fill="#405267" stroke="#c1d0cb" strokeWidth="1"/><ellipse cx="50" cy="50" rx="27" ry="17" fill="#171e36" stroke="#c1d0cb" strokeWidth="1"/>
    {[-.5, .5].map((lane) => <ellipse key={lane} cx="50" cy="50" rx={35 + lane * 5} ry={25 + lane * 5} fill="none" stroke="#94a8bd" strokeWidth=".3" strokeDasharray="2 3"/>)}
    <circle cx="50" cy="50" r="12" fill="#a4a0b2"/><circle cx="46" cy="47" r="3.5" fill="#838097"/><circle cx="55" cy="54" r="2.5" fill="#838097"/>
    <text x="50" y="49" textAnchor="middle" fontSize="3.3" fill="#fff6d9" stroke="#343252" strokeWidth=".4" paintOrder="stroke" fontWeight="900">POLAR CIRCUIT</text><text x="50" y="55" textAnchor="middle" fontSize="3" fill="#fff6d9" stroke="#343252" strokeWidth=".4" paintOrder="stroke">3 LAPS</text>
    <path d="M50 17V33" stroke="#fff" strokeWidth="2" strokeDasharray="1 1"/>
    {RALLY_HAZARDS.map((h, i) => { const p = rallyPoint(h.t, h.lane); return <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.heading * 180 / Math.PI})`}><rect x="-2.3" y="-2" width="4.6" height="4" rx=".5" fill="#d68a70"/><path d="M-2 -1 0 0 -1 1 2 1" fill="none" stroke="#2f2c40" strokeWidth=".5"/></g>; })}
    {RALLY_CELLS.map((c, i) => { const p = rallyPoint(c.t, c.lane); return <g key={i} transform={`translate(${p.x} ${p.y})`}><circle r="2" fill="#74e9dc" stroke="#daffff" strokeWidth=".4"/><path d="M.4 -1.5 -.8 .2 .3 .2 -.4 1.5 .9 -.2 -.2 -.2Z" fill="#21465a"/></g>; })}
    {props.match.players.map((p) => { const kart = s.players[p.id]; if (!kart) return null; const point = rallyPoint(kart.progress, kart.lane); return <g key={p.id} transform={`translate(${point.x} ${point.y})`}><g transform={`rotate(${point.heading * 180 / Math.PI})`}>
      {kart.boostUntil > props.now && <path d="M-3 -1 -8 0 -3 1Z" fill="#90d8ff"/>}<rect x="-3.3" y="-2.7" width="1.2" height="1.7" rx=".4" fill="#151a2a"/><rect x="-3.3" y="1" width="1.2" height="1.7" rx=".4" fill="#151a2a"/><rect x="1.8" y="-2.7" width="1.2" height="1.7" rx=".4" fill="#151a2a"/><rect x="1.8" y="1" width="1.2" height="1.7" rx=".4" fill="#151a2a"/><rect x="-3" y="-2" width="6" height="4" rx="1.4" fill={COLORS[p.avatarId]} stroke="#e4f2ff" strokeWidth=".4"/><circle cx="-.5" r="1.2" fill="#e3ecf0"/><path d="M1 -1 3 0 1 1" fill="#293e55"/>
      </g><text y="-5" fontSize="2.6" fill="#fff" stroke="#102637" strokeWidth=".4" paintOrder="stroke" textAnchor="middle">{p.name}{p.id === props.playerId ? " ★" : ""}</text></g>; })}
  </>;
}

export default function ArcadeMovementScreen(props: MinigameViewProps) {
  const { minigame, playerId, online, now, sendInput, match } = props;
  const id = minigame.minigameId, s = minigame.state as DiscoState | HeistState | KitchenState | RocketState | RallyState;
  const keys = useRef(new Set<string>()), send = useRef(sendInput);
  useEffect(() => { send.current = sendInput; }, [sendInput]);
  const active = online && !!s.players[playerId] && now < s.endsAt;
  const publish = useCallback(() => { const k = keys.current; if (active) send.current({ type: "FESTIVAL_MOVE", x: Number(k.has("KeyD") || k.has("ArrowRight")) - Number(k.has("KeyA") || k.has("ArrowLeft")), y: Number(k.has("KeyS") || k.has("ArrowDown")) - Number(k.has("KeyW") || k.has("ArrowUp")), action: k.has("Space") }); }, [active]);
  const pub = useRef(publish);
  useEffect(() => { pub.current = publish; }, [publish]);
  const change = useCallback((key: string, held: boolean) => { if (held) keys.current.add(key); else keys.current.delete(key); pub.current(); }, []);
  useEffect(() => {
    const held = keys.current, controls = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space"]);
    const down = (e: KeyboardEvent) => { if (!controls.has(e.code) || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return; e.preventDefault(); held.add(e.code); pub.current(); };
    const up = (e: KeyboardEvent) => { if (held.delete(e.code)) pub.current(); };
    const blur = () => { held.clear(); pub.current(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    const timer = setInterval(() => pub.current(), 100);
    return () => { clearInterval(timer); held.clear(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);
  const me = s.players[playerId];
  const heist = id === "pluto-heist" ? s as HeistState : null, kitchen = id === "kitchen-chaos" ? s as KitchenState : null, rocket = id === "rocket-rumble" ? s as RocketState : null, rally = id === "orbital-rally" ? s as RallyState : null, disco = id === "disco-freeze" ? s as DiscoState : null;
  const score = rally ? Number(rally.players[playerId]?.finishedAt !== null && rally.players[playerId]?.finishedAt !== undefined) : me?.score ?? 0, phase = disco?.phase ?? "";
  const previous = useRef({ score, phase });
  useEffect(() => { if (score > previous.current.score) partyAudio.play("delivery"); if (phase !== previous.current.phase && phase) partyAudio.play(phase === "freeze" ? "countdown" : phase === "scratch" ? "miss" : "go"); previous.current = { score, phase }; }, [score, phase]);
  const objective = disco ? disco.phase === "freeze" ? "FREEZE! Release all direction buttons · clean stop +3" : disco.phase === "scratch" ? "FAKE SCRATCH! Keep dancing" : "DANCE! Move to earn points" : heist ? `Cargo ${heist.players[playerId]?.cargo ?? 0}/8 · return to shuttle ${(heist.players[playerId]?.dock ?? 0) + 1} · cloak ${now >= (heist.players[playerId]?.nextCloakAt ?? 0) ? "ready" : `${Math.ceil(((heist.players[playerId]?.nextCloakAt ?? 0) - now) / 1000)}s`}` : kitchen ? `Holding: ${kitchen.players[playerId]?.holding ?? "nothing"} · Take → Chop → Cook → Serve · hold Interact to chop` : rocket ? `Steer your nose, hold thrust · fuel +1 / gold +3 · boost ${now >= (rocket.players[playerId]?.nextBoostAt ?? 0) ? "ready" : `${Math.ceil(((rocket.players[playerId]?.nextBoostAt ?? 0) - now) / 1000)}s`}` : `Lap ${Math.min(3, 1 + Math.floor(rally?.players[playerId]?.progress ?? 0))}/3 · ${rally?.players[playerId]?.charges ?? 0} boost cells · inside lane is faster`;
  const action = heist ? "Cloak" : kitchen ? "Interact" : rocket || rally ? "Boost" : null;
  return <div className={`pp-arcade-game new-minigame arcade-${id}`}>
    <header className="pp-arcade-header"><div><span className="pp-eyebrow">{kitchen ? "TWO CHEFS · ONE TEAM SCORE" : rally ? "MAGNETIC LANES · THREE LAPS" : "FOUR PLAYERS · COSMIC CHAOS"}</span><h2>{minigameRegistry.get(id).name}</h2></div><strong>{Math.max(0, Math.ceil((s.endsAt - now) / 1000))}s</strong></header>
    <div className={`pp-arcade-objective ${disco?.phase === "freeze" ? "freeze" : ""}`} role="status">{objective}</div>
    <svg className="pp-arcade-world" viewBox="0 0 100 100" role="img" aria-label={minigameRegistry.get(id).description}>{disco ? <DiscoScene s={disco} props={props}/> : heist ? <HeistScene s={heist} props={props}/> : kitchen ? <KitchenScene s={kitchen} props={props}/> : rocket ? <RocketScene s={rocket} props={props}/> : <RallyScene s={rally!} props={props}/>}</svg>
    <div className="pp-arcade-controls"><div><HoldControl controlKey="KeyA" label="←" name={rally ? "Move to inside lane" : rocket ? "Steer left" : "Move left"} active={active} change={change}/><HoldControl controlKey="KeyW" label="↑" name={rocket || rally ? "Throttle" : "Move up"} active={active} change={change}/><HoldControl controlKey="KeyS" label="↓" name={rocket || rally ? "Brake" : "Move down"} active={active} change={change}/><HoldControl controlKey="KeyD" label="→" name={rally ? "Move to outside lane" : rocket ? "Steer right" : "Move right"} active={active} change={change}/></div>{action && <HoldControl controlKey="Space" label={action} name={action} active={active} change={change}/>}</div>
    <div className="pp-arcade-scores">{match.players.filter((p) => s.players[p.id]).map((p) => <div key={p.id} className={p.id === playerId ? "me" : ""}><i style={{ background: kitchen ? TEAM_COLORS[kitchen.players[p.id].team] : COLORS[p.avatarId] }}/><span>{p.name}</span><b>{rally ? rally.players[p.id].finishedAt !== null ? `${((rally.players[p.id].finishedAt! - s.startedAt) / 1000).toFixed(1)}s ✓` : `${Math.floor(rally.players[p.id].progress * 100)}%` : s.players[p.id].score}</b></div>)}</div>
  </div>;
}
