import { useEffect, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Sky } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { TRAIL_MAPS, TRAIL_FINISH, type TrailView } from "../../../../games/party/minigames/trailRun/index.ts";
import { COLORS } from "../../../../games/party/config.ts";
import type { MinigameViewProps } from "./views.ts";
import { PartyCharacter } from "./PartyCharacter.tsx";
import { AtmosphereParticles } from "./WorldEffects.tsx";
import { useServerOffset } from "./useServerClock.ts";

function Runner({ p, avatarId, color, name, own, simTime, offset }: { p: TrailView["players"][string]; avatarId: number; color: string; name: string; own: boolean; simTime: number; offset: RefObject<number | null> }) {
  const root = useRef<Group>(null), motion = useRef(0);
  const [initial] = useState<[number, number, number]>(() => [p.x, p.y, (p.lane - 1.5) * 1.8]);
  useFrame((_, dt) => {
    if (!root.current) return;
    const age = Math.min(.12, Math.max(0, (Date.now() + (offset.current ?? 0) - simTime) / 1000));
    const target = new Vector3(p.x + p.vx * age, p.y + (p.grounded ? 0 : p.vy * age), (p.lane - 1.5) * 1.8);
    if (root.current.position.distanceTo(target) > 4) root.current.position.copy(target); else root.current.position.lerp(target, 1 - Math.exp(-24 * dt));
    root.current.rotation.y = p.vx < -.1 ? Math.PI / 2 : -Math.PI / 2; motion.current = Math.min(1, Math.abs(p.vx) / 5);
  });
  return <group ref={root} position={initial}>
    <group scale={.48}><PartyCharacter avatarId={avatarId} color={color} motion={motion}/></group>
    <Html position={[0, 1.1, 0]} center style={{ pointerEvents: "none" }}><span className={"trail-name" + (own ? " me" : "")}>{name}{own ? " · YOU" : ""}</span></Html>
  </group>;
}
function Course({ state, match, playerId, offset }: { state: TrailView; match: MinigameViewProps["match"]; playerId: string; offset: RefObject<number | null> }) {
  const me = state.players[playerId] ?? Object.values(state.players)[0], theme = state.theme;
  useFrame(({ camera, size }, dt) => {
    const portrait = size.width < size.height;
    const x = Math.max(1, Math.min(TRAIL_FINISH[theme] - 3, (me?.x ?? 0) + (portrait ? 1 : 4)));
    const z = portrait ? ((me?.lane ?? 1.5) - 1.5) * 1.8 : 0;
    const target = new Vector3(x - 2, 10.5, z + 14);
    camera.position.lerp(target, 1 - Math.exp(-5 * dt)); camera.lookAt(x, 1.3, z);
  });
  return <>
    <color attach="background" args={[theme === "ice" ? "#b4dcea" : theme === "jungle" ? "#6fbbb0" : "#b5dcff"]}/><hemisphereLight args={["#fff9e7", "#759c9d", 2]}/><directionalLight position={[-5, 18, 7]} intensity={2.4}/>
    {theme === "sky" && <Sky sunPosition={[-15, 12, -25]} rayleigh={.5}/>}
    {TRAIL_MAPS[theme].map((p, i) => <group key={i} position={[p.x, p.y, 0]}>
      {[0, 1, 2, 3].map((lane) => <group key={lane} position={[0, 0, (lane - 1.5) * 1.8]}>
        <mesh position={[0, -.33, 0]}><boxGeometry args={[p.w, .65, 1.5]}/><meshStandardMaterial color={theme === "ice" ? "#87ccde" : theme === "jungle" ? "#8d805e" : "#dcecfb"} roughness={theme === "ice" ? .15 : .8}/></mesh>
        <mesh position={[0, .015, 0]}><boxGeometry args={[p.w, .06, 1.5]}/><meshStandardMaterial color={theme === "ice" ? "#def8ff" : theme === "jungle" ? "#7ecc8d" : "#fff8ee"}/></mesh>
        {(i === 3 || i === 6) && <mesh position={[0, .68, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.65, .065, 6, 24]}/><meshStandardMaterial color="#ffd58b" emissive="#dcaa42" emissiveIntensity={.5}/></mesh>}
      </group>)}
      {theme === "jungle" && <group position={[0, -.6, -4.3]}><mesh position={[0, 1.2, 0]}><cylinderGeometry args={[.18, .32, 3.6, 8]}/><meshStandardMaterial color="#786647"/></mesh><mesh position={[0, 3.2, 0]}><dodecahedronGeometry args={[1.2, 0]}/><meshStandardMaterial color="#368e6e"/></mesh><mesh position={[.7, 3.7, 0]}><dodecahedronGeometry args={[.9, 0]}/><meshStandardMaterial color="#62af72"/></mesh></group>}
      {theme === "ice" && i % 2 === 0 && <mesh position={[0, .5, -4.4]}><coneGeometry args={[.7, 1.3, 5]}/><meshStandardMaterial color="#dcf8ff" roughness={.2}/></mesh>}
      {theme === "sky" && <mesh position={[0, -.8, 0]} scale={[p.w * .8, .4, 3.7]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#f7fbff"/></mesh>}
    </group>)}
    <group position={[TRAIL_FINISH[theme], 0, 0]}><mesh position={[0, 2, 0]}><boxGeometry args={[.15, .3, 7]}/><meshStandardMaterial color="#ffe19b"/></mesh>{[-3.5, 3.5].map((z) => <mesh key={z} position={[0, 1, z]}><cylinderGeometry args={[.06, .06, 2.2, 8]}/><meshStandardMaterial color="#ffe19b"/></mesh>)}<Html position={[0, 2.7, 0]} center><span className="trail-name">FINISH</span></Html></group>
    {match.players.filter((p) => state.players[p.id]).map((p) => <Runner key={p.id} p={state.players[p.id]} name={p.name} own={p.id === playerId} avatarId={p.avatarId} color={COLORS[p.avatarId]} simTime={state.simTime} offset={offset}/>)}
    <AtmosphereParticles kind={theme === "ice" ? "snow" : "dust"} motion area={70}/>
  </>;
}
export default function TrailRunScreen({ minigame, match, playerId, now, online, sendInput }: MinigameViewProps) {
  const s = minigame.state as TrailView, me = s.players[playerId], keys = useRef(new Set<string>()), send = useRef(sendInput), offset = useServerOffset(minigame.serverNow);
  useEffect(() => { send.current = sendInput; }, [sendInput]);
  const enabled = online && s.phase === "race" && !!me && me.finishAt === null;
  useEffect(() => {
    if (!enabled) return;
    const pressed = keys.current;
    const control = () => send.current({ type: "RUN_CONTROL", round: s.round, forward: Number(pressed.has("d") || pressed.has("arrowright")) - Number(pressed.has("a") || pressed.has("arrowleft")), jump: pressed.has(" ") || pressed.has("w") || pressed.has("arrowup") });
    const down = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement || !["a", "d", "w", " ", "arrowleft", "arrowright", "arrowup"].includes(e.key.toLowerCase())) return; e.preventDefault(); pressed.add(e.key.toLowerCase()); control(); };
    const up = (e: KeyboardEvent) => { pressed.delete(e.key.toLowerCase()); control(); };
    const blur = () => { pressed.clear(); control(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    const timer = setInterval(control, 100);
    return () => { clearInterval(timer); pressed.clear(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [enabled, s.round]);
  return <div className={"trail-game new-minigame theme-" + s.theme}>
    <header className="new-game-header"><div><span className="pp-eyebrow">RACE {s.round} / 3 · {s.theme.toUpperCase()}</span><h2>Triple Trail</h2></div><strong>{Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000))}s</strong></header>
    <div className="trail-world"><Canvas camera={{ position: [3, 10.5, 14], fov: 44 }} dpr={[1, 1.25]}><Course state={s} match={match} playerId={playerId} offset={offset}/></Canvas></div>
    {s.phase !== "race" && <div className="trail-round-results"><b>{s.phase === "finished" ? "All three races complete!" : "Race " + s.round + " complete"}</b>{s.results.at(-1)?.ranking.map((id, i) => <p key={id}>{i + 1}. {match.players.find((p) => p.id === id)?.name} <strong>+{s.results.at(-1)?.points[id]} points</strong></p>)}</div>}
    <div className="new-game-scores">{match.players.filter((p) => s.players[p.id]).map((p) => <div key={p.id}><i style={{ background: COLORS[p.avatarId] }}/><span>{p.name}{p.id === playerId ? " · YOU" : ""}<small>{s.players[p.id].finishAt !== null ? "FINISHED" : Math.floor(Math.max(0, s.players[p.id].furthest)) + "m · " + s.players[p.id].falls + " falls"}</small></span><b>{s.players[p.id].score}</b></div>)}</div>
    <div className="trail-controls" role="group" aria-label="Run and jump">{[["a", "←"], ["d", "→"], [" ", "Jump"]].map(([key, label]) => <button key={key} disabled={!enabled} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); keys.current.add(key); send.current({ type: "RUN_CONTROL", round: s.round, forward: key === "a" ? -1 : key === "d" ? 1 : Number(keys.current.has("d")) - Number(keys.current.has("a")), jump: keys.current.has(" ") }); }} onPointerUp={() => keys.current.delete(key)} onPointerCancel={() => keys.current.delete(key)} onLostPointerCapture={() => keys.current.delete(key)}>{label}</button>)}</div>
    <p className="new-game-tip">{me?.finishAt !== null ? "Finish reached · watch the race!" : "Run with A / D · Space to jump · checkpoints save your progress"}</p>
  </div>;
}
