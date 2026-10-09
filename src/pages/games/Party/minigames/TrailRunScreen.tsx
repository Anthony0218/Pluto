import { gameUi, useGameLanguage } from "../../../../i18n/gameUi.ts";
import { memo, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Sky } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { TRAIL_MAPS, TRAIL_FINISH, trailPlatformY, predictTrailRunner, type TrailView } from "../../../../games/party/minigames/trailRun/index.ts";
import { COLORS } from "../../../../games/party/config.ts";
import type { MinigameViewProps } from "./views.ts";
import { PartyCharacter } from "./PartyCharacter.tsx";
import { AtmosphereParticles } from "./WorldEffects.tsx";
import { useServerOffset } from "./useServerClock.ts";

type LocalControl = { forward: number; jump: boolean; jumpAt: number };

function Runner({ p, avatarId, color, name, own, simTime, offset, theme, local, followed, racing, follow }: { p: TrailView["players"][string]; avatarId: number; color: string; name: string; own: boolean; simTime: number; offset: RefObject<number | null>; theme: TrailView["theme"]; local: RefObject<LocalControl>; followed: RefObject<Vector3>; racing: boolean; follow: boolean }) {
  useGameLanguage();
  const root = useRef<Group>(null), motion = useRef(0), target = useRef(new Vector3()), lastFalls = useRef(p.falls);
  const [initial] = useState<[number, number, number]>(() => [p.x, p.y, (p.lane - 1.5) * 1.8]);
  useFrame((_, dt) => {
    if (!root.current) return;
    const now = Date.now() + (offset.current ?? 0);
    const predicted = racing ? predictTrailRunner(p, theme, simTime, now,
      own ? local.current : undefined, own && local.current.jumpAt <= simTime) : p;
    target.current.set(predicted.x, predicted.y, (p.lane - 1.5) * 1.8);
    if (p.falls !== lastFalls.current || root.current.position.distanceTo(target.current) > 4) root.current.position.copy(target.current);
    else root.current.position.lerp(target.current, 1 - Math.exp(-24 * dt));
    lastFalls.current = p.falls;
    if (follow) followed.current.copy(root.current.position);
    root.current.rotation.y = predicted.vx < -.1 ? Math.PI / 2 : -Math.PI / 2; motion.current = Math.min(1, Math.abs(predicted.vx) / 5);
  });
  return <group ref={root} position={initial}>
    <group scale={.48}><PartyCharacter avatarId={avatarId} color={color} motion={motion}/></group>
    <Html position={[0, 1.1, 0]} center style={{ pointerEvents: "none" }}><span className={"trail-name" + (own ? " me" : "")}>{name}{gameUi(own ? " · YOU" : "")}</span></Html>
  </group>;
}
const CourseScenery = memo(function CourseScenery({ theme, offset }: { theme: TrailView["theme"]; offset: RefObject<number | null> }) {
  useGameLanguage();
  return <>
    <color attach="background" args={[theme === "ice" ? "#b4dcea" : theme === "jungle" ? "#6fbbb0" : "#b5dcff"]}/><hemisphereLight args={["#fff9e7", "#759c9d", 2]}/><directionalLight position={[-5, 18, 7]} intensity={2.4}/>
    {theme === "sky" && <Sky sunPosition={[-15, 12, -25]} rayleigh={.5}/>}
    {TRAIL_MAPS[theme].map((p, i) => <MovingPlatform key={i} theme={theme} index={i} offset={offset}>
      {[0, 1, 2, 3].map((lane) => <group key={lane} position={[0, 0, (lane - 1.5) * 1.8]}>
        <mesh position={[0, -.33, 0]}><boxGeometry args={[p.w, .65, 1.5]}/><meshStandardMaterial color={theme === "ice" ? "#87ccde" : theme === "jungle" ? "#8d805e" : "#dcecfb"} roughness={theme === "ice" ? .15 : .8}/></mesh>
        <mesh position={[0, .015, 0]}><boxGeometry args={[p.w, .06, 1.5]}/><meshStandardMaterial color={theme === "ice" ? "#def8ff" : theme === "jungle" ? "#7ecc8d" : "#fff8ee"}/></mesh>
        {theme === "ice" && i % 2 === 1 && <LineCrack width={p.w}/>}
        {gameUi(theme === "jungle" && [2,5,8].includes(i) && [-.5,.5].map((x) => <mesh key={x} position={[x, 1.4, -.65]}><cylinderGeometry args={[.025,.025,2.8,5]}/><meshStandardMaterial color="#376b55"/></mesh>))}
        {(i === 3 || i === 6) && <mesh position={[0, .68, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.65, .065, 6, 24]}/><meshStandardMaterial color="#ffd58b" emissive="#dcaa42" emissiveIntensity={.5}/></mesh>}
      </group>)}
      {theme === "jungle" && <group position={[0, -.6, -4.3]}><mesh position={[0, 1.2, 0]}><cylinderGeometry args={[.18, .32, 3.6, 8]}/><meshStandardMaterial color="#786647"/></mesh><mesh position={[0, 3.2, 0]}><dodecahedronGeometry args={[1.2, 0]}/><meshStandardMaterial color="#368e6e"/></mesh><mesh position={[.7, 3.7, 0]}><dodecahedronGeometry args={[.9, 0]}/><meshStandardMaterial color="#62af72"/></mesh></group>}
      {theme === "ice" && i % 2 === 0 && <mesh position={[0, .5, -4.4]}><coneGeometry args={[.7, 1.3, 5]}/><meshStandardMaterial color="#dcf8ff" roughness={.2}/></mesh>}
      {theme === "sky" && <mesh position={[0, -.8, 0]} scale={[p.w * .8, .4, 3.7]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#f7fbff"/></mesh>}
    </MovingPlatform>)}
    <group position={[TRAIL_FINISH[theme], 0, 0]}><mesh position={[0, 2, 0]}><boxGeometry args={[.15, .3, 7]}/><meshStandardMaterial color="#ffe19b"/></mesh>{[-3.5, 3.5].map((z) => <mesh key={z} position={[0, 1, z]}><cylinderGeometry args={[.06, .06, 2.2, 8]}/><meshStandardMaterial color="#ffe19b"/></mesh>)}<Html position={[0, 2.7, 0]} center><span className="trail-name">{gameUi("FINISH")}</span></Html></group>
    <AtmosphereParticles kind={theme === "ice" ? "snow" : "dust"} motion area={70}/>
  </>;
});

function Course({ state, match, playerId, offset, local }: { state: TrailView; match: MinigameViewProps["match"]; playerId: string; offset: RefObject<number | null>; local: RefObject<LocalControl> }) {
  const me = state.players[playerId] ?? Object.values(state.players)[0], theme = state.theme;
  const followed = useRef(new Vector3(me?.x ?? 0, me?.y ?? 0, ((me?.lane ?? 1.5) - 1.5) * 1.8));
  const cameraTarget = useRef(new Vector3()), lookTarget = useRef(new Vector3(3, 1.3, 0));
  useFrame(({ camera, size }, dt) => {
    const portrait = size.width < size.height;
    const x = Math.max(1, Math.min(TRAIL_FINISH[theme] - 3, followed.current.x + (portrait ? 1 : 4)));
    const z = portrait ? followed.current.z : 0;
    cameraTarget.current.set(x - 2, 10.5, z + 14);
    camera.position.lerp(cameraTarget.current, 1 - Math.exp(-8 * dt));
    lookTarget.current.lerp(cameraTarget.current.set(x, 1.3, z), 1 - Math.exp(-8 * dt));
    camera.lookAt(lookTarget.current);
  });
  return <>
    <CourseScenery theme={theme} offset={offset}/>
    {match.players.filter((p) => state.players[p.id]).map((p) => <Runner key={p.id} p={state.players[p.id]} name={p.name} own={p.id === playerId} avatarId={p.avatarId} color={COLORS[p.avatarId]} simTime={state.simTime} offset={offset} theme={theme} local={local} followed={followed} racing={state.phase === "race"} follow={state.players[p.id] === me}/>)}
  </>;
}
export default function TrailRunScreen({ minigame, match, playerId, now, online, sendInput }: MinigameViewProps) {
  useGameLanguage();
  const s = minigame.state as TrailView, me = s.players[playerId], keys = useRef(new Set<string>()), send = useRef(sendInput), offset = useServerOffset(minigame.serverNow);
  useEffect(() => { send.current = sendInput; }, [sendInput]);
  const local = useRef<LocalControl>({ forward: 0, jump: false, jumpAt: -Infinity });
  const enabled = online && s.phase === "race" && !!me && me.finishAt === null;
  const control = useCallback(() => {
    const pressed = keys.current;
    const forward = Number(pressed.has("d") || pressed.has("arrowright")) - Number(pressed.has("a") || pressed.has("arrowleft"));
    const jump = pressed.has(" ") || pressed.has("w") || pressed.has("arrowup");
    if (jump && !local.current.jump) local.current.jumpAt = Date.now() + (offset.current ?? 0);
    local.current.forward = forward; local.current.jump = jump;
    if (enabled) send.current({ type: "RUN_CONTROL", round: s.round, forward, jump });
  }, [enabled, s.round, offset]);
  const release = useCallback((key: string) => { keys.current.delete(key); control(); }, [control]);
  useEffect(() => {
    local.current = { forward: 0, jump: false, jumpAt: -Infinity };
    if (!enabled) return;
    const pressed = keys.current;
    const down = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.repeat || !["a", "d", "w", " ", "arrowleft", "arrowright", "arrowup"].includes(e.key.toLowerCase())) return; e.preventDefault(); pressed.add(e.key.toLowerCase()); control(); };
    const up = (e: KeyboardEvent) => { if (pressed.has(e.key.toLowerCase())) release(e.key.toLowerCase()); };
    const blur = () => { pressed.clear(); control(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    const timer = setInterval(control, 100);
    return () => { clearInterval(timer); pressed.clear(); local.current = { forward: 0, jump: false, jumpAt: -Infinity }; window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [enabled, control, release]);
  return <div className={"trail-game new-minigame theme-" + s.theme}>
    <header className="new-game-header"><div><span className="pp-eyebrow">{gameUi("RACE ")}{gameUi(s.round)} / 3 · {gameUi(s.theme.toUpperCase())}</span><h2>{gameUi("Triple Trail")}</h2></div><strong>{gameUi(Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000)))}s</strong></header>
    <div className="trail-progress"><b>{gameUi(Math.round(Math.max(0,Math.min(100,(me?.furthest ?? 0) / TRAIL_FINISH[s.theme] * 100))))}%</b><span><i style={{ width: `${Math.max(0,Math.min(100,(me?.furthest ?? 0) / TRAIL_FINISH[s.theme] * 100))}%` }}/></span><small>{gameUi(s.theme === "sky" ? "⇄ WIND" : s.theme === "jungle" ? "↕ SWINGING PLATFORMS" : "❄ SLIPPERY ICE")}{gameUi(" · checkpoint ")}{gameUi(me?.checkpoint ?? 0)}</small></div>
    <div className="trail-world"><Canvas camera={{ position: [3, 10.5, 14], fov: 44 }} dpr={[1, 1.25]}><Course key={s.round} state={s} match={match} playerId={playerId} offset={offset} local={local}/></Canvas></div>
    {s.phase !== "race" && <div className="trail-round-results"><b>{gameUi(s.phase === "finished" ? "All three races complete!" : "Race " + s.round + " complete")}</b>{s.results.at(-1)?.ranking.map((id, i) => <p key={id}>{gameUi(i + 1)}. {match.players.find((p) => p.id === id)?.name} <strong>+{gameUi(s.results.at(-1)?.points[id])}{gameUi(" points")}</strong></p>)}</div>}
    <div className="new-game-scores">{match.players.filter((p) => s.players[p.id]).map((p) => <div key={p.id}><i style={{ background: COLORS[p.avatarId] }}/><span>{p.name}{gameUi(p.id === playerId ? " · YOU" : "")}<small>{gameUi(s.players[p.id].finishAt !== null ? "FINISHED" : Math.floor(Math.max(0, s.players[p.id].furthest)) + "m · " + s.players[p.id].falls + " falls")}</small></span><b>{gameUi(s.players[p.id].score)}</b></div>)}</div>
    <div className="trail-controls" role="group" aria-label={gameUi("Run and jump")}>{[["a", "←"], ["d", "→"], [" ", "Jump"]].map(([key, label]) => <button key={key} disabled={!enabled} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); keys.current.add(key); control(); }} onPointerUp={() => release(key)} onPointerCancel={() => release(key)} onLostPointerCapture={() => { if (keys.current.has(key)) release(key); }}>{gameUi(label)}</button>)}</div>
    <p className="new-game-tip">{gameUi(me && me.finishAt !== null ? "Finish reached · watch the race!" : "Run with A / D · Space to jump · checkpoints save your progress")}</p>
  </div>;
}

function MovingPlatform({ theme, index, offset, children }: { theme: TrailView["theme"]; index: number; offset: RefObject<number | null>; children: React.ReactNode }) {
  useGameLanguage();
  const group = useRef<Group>(null), platform = TRAIL_MAPS[theme][index];
  useFrame(() => { if (group.current) group.current.position.y = trailPlatformY(theme, index, Date.now() + (offset.current ?? 0)); });
  return <group ref={group} position={[platform.x, platform.y, 0]}>{gameUi(children)}</group>;
}
function LineCrack({ width }: { width: number }) {
  useGameLanguage(); return <group>{[-.2,.2].map((x) => <mesh key={x} position={[x,.06,0]} rotation={[-Math.PI/2,0,x]}><planeGeometry args={[.025,width*.3]}/><meshBasicMaterial color="#6a9fc0"/></mesh>)}</group>; }
