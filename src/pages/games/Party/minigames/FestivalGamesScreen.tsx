import { gameUi, useGameLanguage } from "../../../../i18n/gameUi.ts";
import { useCallback, useEffect, useRef } from "react";
import { COLORS } from "../../../../games/party/config.ts";
import { minigameRegistry } from "../../../../games/party/minigames/index.ts";
import { tideRadius, type TideState } from "../../../../games/party/minigames/festivalGames/tideTreasure.ts";
import { DELIVERY_PADS, type CourierState } from "../../../../games/party/minigames/festivalGames/cometCourier.ts";
import { ROPE_GATES, type RopeState } from "../../../../games/party/minigames/festivalGames/ropeRescue.ts";
import type { DoublesState } from "../../../../games/party/minigames/festivalGames/paddleDoubles.ts";
import type { Mover } from "../../../../games/party/minigames/festivalGames/common.ts";
import type { MinigameViewProps } from "./views.ts";
import { CharacterFace } from "../CharacterFace.tsx";
import { partyAudio } from "../../../../games/party/client/audio.ts";
const TEAMS = ["#8cdbff", "#ffa6d1"];
const PAD_SYMBOLS = ["★", "◆", "●", "▲"];
function Players({ players, match, playerId }: { players: Record<string, Mover & { team?: number }>; match: MinigameViewProps["match"]; playerId: string }) {
  return <>{match.players.filter((p) => players[p.id]).map((p) => { const mover = players[p.id], color = mover.team === undefined ? COLORS[p.avatarId] : TEAMS[mover.team]; return <g key={p.id} transform={`translate(${mover.x} ${mover.y})`}><ellipse cy="3" rx="3.6" ry="1.8" fill="#102637" opacity=".25"/><circle r={p.id === playerId ? 4.7 : 3.8} fill="none" stroke={color} strokeWidth={p.id === playerId ? .9 : .4}/><svg x="-3" y="-5" width="6" height="7" viewBox="0 0 64 72"><CharacterFace avatarId={p.avatarId}/></svg><text y="-6" textAnchor="middle" fill="#fff" stroke="#102637" strokeWidth=".3" paintOrder="stroke" fontSize="2.8" fontWeight="800">{p.name}{gameUi(p.id === playerId ? " ★" : "")}</text></g>; })}</>;
}
function TideScene({ s, props }: { s: TideState; props: MinigameViewProps }) {
  useGameLanguage();
  const radius = tideRadius(s, props.now), phase = (props.now - s.startedAt) % 15000;
  return <><rect width="100" height="100" fill="#126b89"/>{[0, 1, 2, 3].map((i) => <path key={i} d={`M0 ${20 + i * 20}q10 -3 20 0t20 0t20 0t20 0t20 0`} fill="none" stroke="#78d7e0" strokeWidth=".6" opacity=".25"/>)}<circle cx="59" cy="50" r="43" fill="#5ead9b" opacity=".4"/><circle cx="59" cy="50" r={radius + 2} fill="#efd6a0"/><circle cx="59" cy="50" r={radius} fill="#a3c997"/><path d="M12 50H60" stroke="#906b56" strokeWidth="7"/><path d="M12 50H60" stroke="#ffdda2" strokeWidth="5" strokeDasharray="1 2"/>
    <rect x="2" y="37" width="13" height="26" rx="6" fill="#edb775" stroke="#684d4c"/><text x="8" y="51" textAnchor="middle" fontSize="3" fill="#263a4b">{gameUi("BANK")}</text>
    {s.treasures.filter((gem) => gem.respawnAt <= props.now).map((gem) => <g key={gem.id} transform={`translate(${gem.x} ${gem.y})`}><path d="M0 -2.4 2.1 0 0 2.4 -2.1 0Z" fill={gem.value === 5 ? "#d9b1ff" : gem.value === 3 ? "#ffd379" : "#ecfbff"} stroke="#fff4d6" strokeWidth=".5"/><text y="5" textAnchor="middle" fill="#153c4b" fontSize="2.5">{gameUi(gem.value)}</text></g>)}
    <Players players={s.players} match={props.match} playerId={props.playerId}/><text x="96" y="8" textAnchor="end" fill="#fff4cb" fontSize="3.4" fontWeight="800">{gameUi(phase > 8000 ? "⚠ TIDE RISING · RETURN TO THE BOAT" : "LOW TIDE · EXPLORE")}</text></>;
}
function CourierScene({ s, props }: { s: CourierState; props: MinigameViewProps }) {
  useGameLanguage();
  return <><rect width="100" height="100" fill="#263551"/>{[20, 40, 60, 80].map((n) => <g key={n}><path d={`M${n} 0V100M0 ${n}H100`} stroke="#7390a7" strokeWidth=".35" opacity=".35"/></g>)}<circle cx="50" cy="50" r="22" fill="#3b4b6d" stroke="#8598bc" strokeDasharray="1 3"/>
    {DELIVERY_PADS.map((pad, i) => <g key={i} transform={`translate(${pad.x} ${pad.y})`}><rect x="-7" y="-7" width="14" height="14" rx="3" fill={COLORS[i]} fillOpacity=".25" stroke={COLORS[i]}/><text textAnchor="middle" y="2" fill={COLORS[i]} fontSize="7">{gameUi(PAD_SYMBOLS[i])}</text></g>)}
    {s.parcels.filter((parcel) => parcel.respawnAt <= props.now).map((parcel) => <g key={parcel.id} transform={`translate(${parcel.x} ${parcel.y - (parcel.carrier ? 5 : 0)})`}><rect x="-2.5" y="-2.5" width="5" height="5" rx=".6" fill={parcel.value === 3 ? "#ffe492" : COLORS[parcel.destination]} stroke="#fff" strokeWidth=".5"/><text y="1.2" textAnchor="middle" fontSize="3" fill="#23354d">{gameUi(PAD_SYMBOLS[parcel.destination])}</text></g>)}
    <Players players={s.players} match={props.match} playerId={props.playerId}/>{s.deliveries.map((d) => <text key={d.playerId + d.at} x={d.x} y={d.y - 9} fill="#fff1a9" fontSize="4" textAnchor="middle" className="festival-score-pop">+{gameUi(d.value)}!</text>)}</>;
}
function RopeScene({ s, props }: { s: RopeState; props: MinigameViewProps }) {
  useGameLanguage();
  return <><rect width="100" height="100" fill="#20394c"/>{s.teams.map((team, i) => { const y = 30 + i * 45, color = TEAMS[i], gate = ROPE_GATES.find((gate) => gate.x >= team.progress) ?? ROPE_GATES[0]; const runner = team.ids.find((id) => !s.players[id].operator)!; return <g key={i}>
    <text x="5" y={y - 18} fill={color} fontSize="3.3" fontWeight="800">{gameUi("TEAM ")}{gameUi(i + 1)} · {gameUi(team.ids.map((id) => props.match.players.find((p) => p.id === id)?.name).join(" + "))} · {gameUi(team.rescues)}{gameUi(" rescued")}</text>
    <path d={`M5 ${y}H95`} stroke="#96745a" strokeWidth="5"/><path d={`M5 ${y}H95`} stroke="#ffe7b7" strokeWidth=".4" strokeDasharray="1 1"/>
    {ROPE_GATES.map((g) => { const aligned = Math.abs(team.lever - g.target) <= 10; return <g key={g.x}><rect x={g.x + 4} y={y - 3} width="6" height="6" fill={aligned ? color : "#163347"} stroke={aligned ? "#fff" : "#fc9d91"} strokeDasharray={aligned ? undefined : "1 1"}/><text x={g.x + 7} y={y + 8} textAnchor="middle" fill="#ffecd2" fontSize="2.8">{gameUi(g.target)}%</text></g>; })}
    <g transform={`translate(${5 + team.progress * .86} ${y - 4})`}><svg x="-3" y="-4" width="6" height="7" viewBox="0 0 64 72"><CharacterFace avatarId={props.match.players.find((p) => p.id === runner)?.avatarId ?? 0}/></svg></g>
    <text x="96" y={y - 5} fontSize="7" textAnchor="end">⛺</text><rect x="5" y={y + 12} width="88" height="3" rx="1.5" fill="#52727e"/><rect x={5 + gate.target * .88 - 4} y={y + 11} width="8" height="5" rx="1" fill={color} opacity=".55"/><circle cx={5 + team.lever * .88} cy={y + 13.5} r="2.5" fill="#fff4d2"/>
    <text x="5" y={y + 22} fill="#d6eaff" fontSize="2.8">{gameUi("LEVER ")}{gameUi(Math.round(team.lever))}{gameUi("% · TARGET ")}{gameUi(gate.target)}% · {gameUi(s.swapped ? "ROLES SWAPPED" : "SWAP AT 30s")}</text>
    </g>; })}</>;
}
function DoublesScene({ s, props }: { s: DoublesState; props: MinigameViewProps }) {
  useGameLanguage();
  return <><rect width="100" height="100" fill="#182d49"/><path d="M50 0V100" stroke="#a8c7ed" strokeDasharray="2 3" opacity=".3"/><path d="M0 50H100" stroke="#a8c7ed" opacity=".12"/><circle cx="50" cy="50" r="14" fill="none" stroke="#a8c7ed" opacity=".2"/>
    <text x="25" y="12" textAnchor="middle" fill={TEAMS[0]} fontSize="8" fontWeight="900">{gameUi(s.teamScores[0])}</text><text x="75" y="12" textAnchor="middle" fill={TEAMS[1]} fontSize="8" fontWeight="900">{gameUi(s.teamScores[1])}</text>
    {props.match.players.map((p) => { const paddle = s.players[p.id]; if (!paddle) return null; return <g key={p.id}><rect x={paddle.x - 1.2} y={paddle.y - 10} width="2.4" height="20" rx="1.2" fill={TEAMS[paddle.team]} stroke={p.id === props.playerId ? "#fff" : undefined} strokeWidth=".7"/><text x={paddle.x + (paddle.team ? -4 : 4)} y={paddle.y + 1} textAnchor={paddle.team ? "end" : "start"} fill="#e8f2ff" fontSize="3">{p.name}{gameUi(p.id === props.playerId ? " ★" : "")}</text></g>; })}
    <circle cx={s.ball.x} cy={s.ball.y} r={s.ball.value === 2 ? 2.8 : 2} fill={s.ball.value === 2 ? "#ffdc7a" : "#eeffff"}/><text x="50" y="95" textAnchor="middle" fill="#ffdda4" fontSize="3">{gameUi(s.ball.value === 2 ? "GOLDEN COMET · 2 POINTS" : "FIRST TEAM TO 7")}</text></>;
}
export default function FestivalGamesScreen(props: MinigameViewProps) {
  useGameLanguage();
  const { minigame, match, playerId, now, online, sendInput } = props;
  const id = minigame.minigameId, s = minigame.state as TideState | CourierState | RopeState | DoublesState;
  const keys = useRef(new Set<string>()), send = useRef(sendInput); send.current = sendInput;
  const publish = useCallback(() => { const k = keys.current; if (online && now < s.endsAt) send.current({ type: "FESTIVAL_MOVE", x: Number(k.has("KeyD") || k.has("ArrowRight")) - Number(k.has("KeyA") || k.has("ArrowLeft")), y: Number(k.has("KeyS") || k.has("ArrowDown")) - Number(k.has("KeyW") || k.has("ArrowUp")), action: k.has("Space") }); }, [online, now, s.endsAt]);
  const pub = useRef(publish); pub.current = publish;
  useEffect(() => { const held = keys.current; const controls = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space"]);
    const down = (e: KeyboardEvent) => { if (!controls.has(e.code) || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return; e.preventDefault(); held.add(e.code); pub.current(); };
    const up = (e: KeyboardEvent) => { if (held.delete(e.code)) pub.current(); }; const blur = () => { held.clear(); pub.current(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur); const timer = setInterval(() => pub.current(), 100);
    return () => { clearInterval(timer); held.clear(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);
  const me = s.players[playerId], rope = id === "rope-rescue" ? s as RopeState : null, courier = id === "comet-courier" ? s as CourierState : null;
  const score = me?.score ?? 0;
  const losses = id === "tide-treasure" ? (s as TideState).players[playerId]?.losses ?? 0 : rope && me ? rope.teams[rope.players[playerId].team].falls : 0;
  const returns = id === "paddle-doubles" ? Object.values((s as DoublesState).players).reduce((total, p) => total + p.returns, 0) : 0;
  const feedback = useRef({ score, losses, returns });
  useEffect(() => {
    const before = feedback.current;
    if (score > before.score) partyAudio.play("delivery");
    if (losses > before.losses) partyAudio.play("splash");
    if (returns > before.returns) partyAudio.play("paddle");
    feedback.current = { score, losses, returns };
  }, [score, losses, returns]);
  const description = id === "tide-treasure" ? `Carrying ${(s as TideState).players[playerId]?.carried ?? 0} · banked ${me?.score ?? 0}` : courier ? courier.players[playerId]?.parcel !== null ? "Match your parcel’s symbol to a delivery pad" : "Find a parcel · dash with Space" : rope ? rope.players[playerId]?.operator ? "YOU OPERATE · align the lever using ↑ / ↓" : "YOU RUN · cross when your partner aligns the bridge" : "Cover your half · move with ↑ / ↓";
  const button = (key: string, label: string) => <button key={key} disabled={!online || !me || now >= s.endsAt} aria-label={gameUi(label)} onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); keys.current.add(key); publish(); }} onPointerUp={() => { keys.current.delete(key); publish(); }} onPointerCancel={() => { keys.current.delete(key); publish(); }} onLostPointerCapture={() => { keys.current.delete(key); publish(); }}>{gameUi(label)}</button>;
  return <div className={"festival-game new-minigame festival-" + id}><header className="new-game-header"><div><span className="pp-eyebrow">{gameUi(rope || id === "paddle-doubles" ? "TEAMWORK · TWO VS TWO" : "SHARED ARENA · FOUR PLAYERS")}</span><h2>{gameUi(minigameRegistry.get(id).name)}</h2></div><strong>{gameUi(Math.max(0, Math.ceil((s.endsAt - now) / 1000)))}s</strong></header>
    <div className="festival-objective" aria-live="polite">{gameUi(description)}</div><svg className="festival-world" viewBox="0 0 100 100" role="img" aria-label={gameUi(minigameRegistry.get(id).description)}>
      {gameUi(id === "tide-treasure" ? <TideScene s={s as TideState} props={props}/> : courier ? <CourierScene s={courier} props={props}/> : rope ? <RopeScene s={rope} props={props}/> : <DoublesScene s={s as DoublesState} props={props}/>)}
    </svg><div className="festival-controls"><div>{gameUi(id === "paddle-doubles" || rope?.players[playerId]?.operator ? <>{gameUi(button("KeyW", "↑"))}{gameUi(button("KeyS", "↓"))}</> : rope ? <>{gameUi(button("KeyA", "←"))}{gameUi(button("KeyD", "→"))}</> : <>{gameUi(button("KeyW", "↑"))}{gameUi(button("KeyA", "←"))}{gameUi(button("KeyS", "↓"))}{gameUi(button("KeyD", "→"))}</>)}</div>{gameUi((courier || rope && !rope.players[playerId]?.operator) && button("Space", courier ? "Dash" : "Jump"))}</div>
    <div className="new-game-scores">{match.players.filter((p) => s.players[p.id]).map((p) => <div key={p.id}><i style={{ background: COLORS[p.avatarId] }}/><span>{p.name}{gameUi(p.id === playerId ? " · YOU" : "")}</span><b>{gameUi(s.players[p.id].score)}</b></div>)}</div>
  </div>;
}
