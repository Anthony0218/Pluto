import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrthographicCamera } from "@react-three/drei";
import { Group, ShaderMaterial } from "three";
import { HELL_ISLANDS, islandCollapseAt, PUNCH_COOLDOWN, KNOCKBACK_HP, LAVA_Y, type KnockbackInput, type KnockbackPlayer, type KnockbackView } from "../../../../games/party/minigames/lavaKnockback/index.ts";
import { COLORS } from "../../../../games/party/config.ts";
import type { MinigameViewProps } from "./views.ts";
import { PartyCharacter } from "./PartyCharacter.tsx";
import { useServerClock, useServerOffset } from "./useServerClock.ts";
import { useSceneMotion } from "./useSceneMotion.ts";

const LAVA_VERTEX = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LAVA_FRAGMENT = `varying vec2 vUv; uniform float uTime;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
}
void main() {
  vec2 p = vUv * 36.0; p += vec2(sin(p.y*.7+uTime*.13),cos(p.x*.6-uTime*.1))*.32;
  float n = noise(p) + .26 * noise(p*2.7 + uTime*.035);
  float vein = 1.0-smoothstep(.025,.16,abs(n-.64));
  vec3 crust = mix(vec3(.13,.025,.045),vec3(.55,.075,.025),smoothstep(.2,.8,n));
  vec3 lava = mix(crust,vec3(1.0,.38,.055),vein);
  lava += vec3(.17,.075,.008) * pow(vein,3.0);
  gl_FragColor = vec4(lava,1.0);
}`;

function ArenaCamera() {
  const { size } = useThree();
  return <OrthographicCamera makeDefault position={[0, 34, 22]} zoom={Math.min(size.width / 34, size.height / 28)} near={.1} far={110} onUpdate={(camera) => camera.lookAt(0, 0, 0)}/>;
}
function Lava() {
  const material = useRef<ShaderMaterial>(null), motion = useSceneMotion();
  useFrame(({ clock }) => { if (material.current) material.current.uniforms.uTime.value = motion ? clock.elapsedTime : 0; });
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, LAVA_Y, 0]}><planeGeometry args={[70, 70]}/><shaderMaterial ref={material} vertexShader={LAVA_VERTEX} fragmentShader={LAVA_FRAGMENT} uniforms={{ uTime: { value: 0 } }}/></mesh>
    {Array.from({ length: 24 }, (_, i) => {
      const x = Math.sin(i * 12.7) * 24, z = Math.cos(i * 8.3) * 24;
      return <mesh key={i} rotation={[-Math.PI / 2, 0, i * .7]} position={[x, LAVA_Y + .03, z]}><torusGeometry args={[.8 + i % 3, .07, 4, 32, Math.PI * 1.5]}/><meshBasicMaterial color="#ffb54c" transparent opacity={.3}/></mesh>;
    })}
  </group>;
}
function Fighter({ p, color, name, mine, hitAt, offset }: { p: KnockbackPlayer; color: string; name: string; mine: boolean; hitAt?: number; offset: RefObject<number | null> }) {
  const root = useRef<Group>(null), fist = useRef<Group>(null), motion = useRef(0), initialized = useRef(false);
  useFrame((_, dt) => {
    if (!root.current) return;
    const blend = initialized.current ? 1 - Math.exp(-18 * dt) : 1;
    root.current.position.x += (p.x - root.current.position.x) * blend;
    root.current.position.y += (p.y - root.current.position.y) * blend;
    root.current.position.z += (p.z - root.current.position.z) * blend;
    const delta = Math.atan2(Math.sin(-p.yaw - root.current.rotation.y), Math.cos(-p.yaw - root.current.rotation.y));
    root.current.rotation.y += delta * blend;
    motion.current = Math.min(1, Math.hypot(p.x - root.current.position.x, p.z - root.current.position.z) * 4);
    const age = Date.now() + (offset.current ?? 0) - p.lastPunchAt;
    if (fist.current) fist.current.position.z = -.4 - (age >= 0 && age < 240 ? Math.sin(age / 240 * Math.PI) * .7 : 0);
    initialized.current = true;
  });
  if (p.eliminatedAt !== null) return null;
  return <group ref={root}>
    <PartyCharacter avatarId={p.avatarId} color={color} motion={motion} hitAt={hitAt} offset={offset}/>
    <group ref={fist} position={[.4, .85, -.4]}><mesh><sphereGeometry args={[.18, 12, 8]}/><meshStandardMaterial color="#e7b89c"/></mesh><mesh position={[0, 0, .15]}><capsuleGeometry args={[.085, .17, 4, 8]}/><meshStandardMaterial color={color}/></mesh></group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .025, 0]}><ringGeometry args={[mine ? .55 : .45, mine ? .64 : .5, 32]}/><meshBasicMaterial color={color}/></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, -.95]}><coneGeometry args={[.16, .36, 3]}/><meshBasicMaterial color={color}/></mesh>
    <Html position={[0, 3.5, 0]} center style={{ pointerEvents: "none" }}><div className="knockback-name" style={{ borderColor: color }}><b>{name}{mine ? " · YOU" : ""}</b><span><i style={{ width: `${p.hp / KNOCKBACK_HP * 100}%`, background: color }}/></span></div></Html>
  </group>;
}
const neutral = (): KnockbackInput => ({ type: "KNOCKBACK_CONTROL", x: 0, z: 0, yaw: 0, punch: false, jump: false, guard: false });
export default function LavaKnockbackScreen({ minigame, match, playerId, online, sendInput }: MinigameViewProps) {
  const state = minigame.state as KnockbackView, me = state.players[playerId];
  const offset = useServerOffset(minigame.serverNow), time = useServerClock(minigame.serverNow, 100);
  const live = useRef(state), held = useRef(neutral()), keys = useRef(new Set<string>()), touch = useRef(new Set<string>()), send = useRef(sendInput);
  useEffect(() => { live.current = state; }, [state]);
  useEffect(() => { send.current = sendInput; }, [sendInput]);
  const publish = useCallback(() => {
    const s = live.current, at = Date.now() + (offset.current ?? 0);
    if (!online || !s.players[playerId] || s.players[playerId].eliminatedAt !== null || at < s.startedAt || at >= s.endsAt || Object.values(s.players).filter((p) => p.eliminatedAt === null).length <= 1) return;
    const has = (...codes: string[]) => codes.some((code) => keys.current.has(code) || touch.current.has(code));
    held.current.x = Number(has("KeyD", "ArrowRight")) - Number(has("KeyA", "ArrowLeft"));
    held.current.z = Number(has("KeyS", "ArrowDown")) - Number(has("KeyW", "ArrowUp"));
    held.current.guard = has("KeyG"); held.current.jump = has("Space"); held.current.punch = has("KeyF", "Fire");
    send.current({ ...held.current });
  }, [online, offset, playerId]);
  useEffect(() => {
    const pressedKeys = keys.current, pressedTouch = touch.current;
    const controls = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space", "KeyF", "KeyG"]);
    const down = (e: KeyboardEvent) => { if (!controls.has(e.code) || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; e.preventDefault(); keys.current.add(e.code); publish(); };
    const up = (e: KeyboardEvent) => { if (controls.has(e.code)) { keys.current.delete(e.code); publish(); } };
    const releaseMouse = () => { touch.current.delete("Fire"); publish(); };
    const blur = () => { keys.current.clear(); touch.current.clear(); publish(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("pointerup", releaseMouse); window.addEventListener("pointercancel", releaseMouse); window.addEventListener("blur", blur);
    const timer = setInterval(publish, 75);
    return () => { clearInterval(timer); pressedKeys.clear(); pressedTouch.clear(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("pointerup", releaseMouse); window.removeEventListener("pointercancel", releaseMouse); window.removeEventListener("blur", blur); };
  }, [publish]);
  const button = (code: string, label: string) => <button key={code} disabled={!online || !me || me.eliminatedAt !== null}
    onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); touch.current.add(code);
      const direction: Record<string, number> = { KeyW: 0, KeyS: Math.PI, KeyA: -Math.PI / 2, KeyD: Math.PI / 2 };
      if (direction[code] !== undefined) held.current.yaw = direction[code]; publish(); }}
    onPointerUp={() => { touch.current.delete(code); publish(); }} onPointerCancel={() => { touch.current.delete(code); publish(); }}
    onLostPointerCapture={() => { touch.current.delete(code); publish(); }} aria-label={label}>{label}</button>;
  const elapsed = time - state.startedAt;
  const nextCollapse = [25000, 50000, 65000].find((at) => elapsed < at);
  const alive = Object.values(state.players).filter((p) => p.eliminatedAt === null).length;
  return <div className="knockback-game new-minigame">
    <header className="new-game-header"><div><span className="pp-eyebrow">FISTS ONLY · LAST SURVIVOR WINS</span><h2>Hell Knockout</h2></div><strong>{alive} alive · {Math.max(0, Math.ceil((state.endsAt - time) / 1000))}s</strong></header>
    <div className="knockback-collapse">{nextCollapse && nextCollapse - elapsed <= 5000 ? `⚠ Glowing islands collapse in ${Math.ceil((nextCollapse - elapsed) / 1000)}s · move to the center!` : "Glowing edges warn you before islands collapse · G to guard"}</div><div className="knockback-world">
      <Canvas orthographic camera={{ position: [0, 34, 22], zoom: 20, near: .1, far: 110 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#210b20"]}/><fog attach="fog" args={["#210b20", 48, 85]}/>
        <ArenaCamera/><hemisphereLight args={["#e5c9ff", "#a9320f", 2.2]}/><directionalLight position={[-8, 20, 8]} intensity={2.6} color="#ffe0ba"/>
        <Lava/>
        {HELL_ISLANDS.map((island, i) => elapsed >= islandCollapseAt(i) ? null : <group key={i} position={[island.x, 0, island.z]}>
          <mesh position={[0, -1.1, 0]}><cylinderGeometry args={[island.radius, island.radius * .7, 2.2, 12, 1, true]}/><meshStandardMaterial color="#332d3c" roughness={.98} flatShading/></mesh>
          <mesh position={[0, -.035, 0]}><cylinderGeometry args={[island.radius, island.radius, .07, 48]}/><meshStandardMaterial color={islandCollapseAt(i) - elapsed < 5000 ? "#b05938" : i === 0 ? "#56445e" : "#494052"} emissive={islandCollapseAt(i) - elapsed < 5000 ? "#ff5b22" : "#000000"} emissiveIntensity={islandCollapseAt(i) - elapsed < 5000 ? .4 + .3 * Math.sin(elapsed / 130) : 0} roughness={.92}/></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .008, 0]}><ringGeometry args={[island.radius - .08, island.radius, 48]}/><meshBasicMaterial color="#ff8956"/></mesh>
          {Array.from({ length: island.radius > 3 ? 5 : 2 }, (_, j) => <mesh key={j} position={[Math.cos(j * 2.3) * island.radius * .75, .1, Math.sin(j * 2.3) * island.radius * .75]} rotation={[0, j * .8, 0]}><dodecahedronGeometry args={[.12 + (j % 3) * .06, 0]}/><meshStandardMaterial color="#796579" roughness={1} flatShading/></mesh>)}
        </group>)}
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => <group key={`${x}:${z}`} position={[x * 19, LAVA_Y, z * 18]}><mesh><coneGeometry args={[3.8, 9, 7]}/><meshStandardMaterial color="#271f30" flatShading/></mesh><mesh position={[0, 3.6, 0]}><coneGeometry args={[1.1, 1.8, 7]}/><meshStandardMaterial color="#e75429" emissive="#ff4f13" emissiveIntensity={1}/></mesh></group>))}
        {match.players.filter((p) => state.players[p.id]).map((p) => <Fighter key={p.id} p={state.players[p.id]} name={p.name} mine={p.id === playerId} color={COLORS[p.avatarId % COLORS.length]} offset={offset} hitAt={state.hits.filter((h) => h.victim === p.id).at(-1)?.at}/>)}
        {state.hits.map((h) => <Html key={h.id} position={[h.x, h.y + .8, h.z]} center style={{ pointerEvents: "none" }}><span className="knockback-damage">−{h.damage}</span></Html>)}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .02, 0]}
          onPointerMove={(e) => { const p = live.current.players[playerId]; if (p) held.current.yaw = Math.atan2(e.point.x - p.x, p.z - e.point.z); }}
          onPointerDown={(e) => { if (e.pointerType === "mouse" && e.button === 0) { touch.current.add("Fire"); publish(); } }}>
          <planeGeometry args={[70, 70]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/>
        </mesh>
      </Canvas>
      <div className="knockback-hud"><b>{me && me.eliminatedAt !== null ? "ELIMINATED" : `${me?.hp ?? 0} / 200 HP`}</b><span>{me && me.eliminatedAt !== null ? (me.reason === "lava" ? "You fell into lava. Watch the survivors." : "You ran out of HP. Watch the survivors.") : me?.guarding ? "GUARDING · reduced damage and knockback" : "Punch: −10 HP · G: guard"}</span><small>{time - (me?.lastPunchAt ?? 0) >= PUNCH_COOLDOWN ? "FIST READY" : "Fist recovering…"} · mouse aim · Space jump</small><span className="knockback-punch-meter"><i style={{ width: `${Math.max(0, Math.min(100, (time - (me?.lastPunchAt ?? 0)) / PUNCH_COOLDOWN * 100))}%` }}/></span></div>
    </div>
    <div className="knockback-controls"><div className="knockback-dpad">{button("KeyW", "↑")}{button("KeyA", "←")}{button("KeyS", "↓")}{button("KeyD", "→")}</div><div>{button("Space", "Jump")}{button("KeyF", "Punch")}{button("KeyG", "Guard")}</div></div>
    <div className="new-game-scores">{match.players.filter((p) => state.players[p.id]).map((p) => <div key={p.id}><i style={{ background: COLORS[p.avatarId % COLORS.length] }}/><span>{p.name}</span><b>{state.players[p.id].eliminatedAt === null ? `${state.players[p.id].hp} HP` : "OUT"}</b></div>)}</div>
    <p className="new-game-tip">WASD / arrows · mouse to aim · click / F to punch · Space to jump · touch arrows also aim</p>
  </div>;
}
