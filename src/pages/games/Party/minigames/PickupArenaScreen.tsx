import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Group, Mesh } from "three";
import { COLORS } from "../../../../games/party/config.ts";
import { ARENA_MAPS, WEAPONS } from "../../../../games/party/minigames/pickupArena/maps.ts";
import { moveArenaPlayer, type ArenaInput, type ArenaView } from "../../../../games/party/minigames/pickupArena/index.ts";
import type { MinigameViewProps } from "./views.ts";
import { useServerOffset } from "./useServerClock.ts";
import { ArenaWorld } from "./ArenaWorld.tsx";
import { ArenaCharacter, HitBurst, HitDamageNumber, WeaponModel, WeaponPickup, SupplyPickup } from "./ArenaFeedback.tsx";

interface Aim { yaw: number; pitch: number }
function CameraRig({ state, playerId, avatarId, aim, held, offset }: { state: ArenaView; playerId: string; avatarId: number; aim: MutableRefObject<Aim>; held: MutableRefObject<ArenaInput>; offset: RefObject<number | null> }) {
  const hand = useRef<Group>(null), muzzle = useRef<Mesh>(null), initialized = useRef(false);
  const me = state.players[playerId] ?? Object.values(state.players)[0];
  const predicted = useRef({ x: 0, y: 0, z: 0 }), correction = useRef({ x: 0, y: 0, z: 0 }), dead = useRef(false);
  useEffect(() => {
    if (!me) return;
    const target = { x: me.x, y: me.y, z: me.z };
    if (me.hp > 0) moveArenaPlayer(ARENA_MAPS[state.map], target, held.current, Math.min(.15, Math.max(0, (Date.now() + (offset.current ?? 0) - state.simTime) / 1000)));
    const error = Math.hypot(target.x - predicted.current.x, target.y - predicted.current.y, target.z - predicted.current.z);
    if (!initialized.current || error > 2.5 || (dead.current && me.hp > 0)) { predicted.current = target; correction.current = { x: 0, y: 0, z: 0 }; initialized.current = true; }
    else correction.current = { x: target.x - predicted.current.x, y: target.y - predicted.current.y, z: target.z - predicted.current.z };
    dead.current = me.hp <= 0;
  }, [me, state.simTime, state.map, held, offset]);
  useFrame(({ camera }, dt) => {
    if (!me) return;
    if (me.hp > 0) moveArenaPlayer(ARENA_MAPS[state.map], predicted.current, { ...held.current, yaw: aim.current.yaw }, Math.min(dt, .05));
    const blend = 1 - Math.exp(-10 * dt);
    for (const axis of ["x", "y", "z"] as const) { predicted.current[axis] += correction.current[axis] * blend; correction.current[axis] *= 1 - blend; }
    camera.position.set(predicted.current.x, predicted.current.y + 1.55, predicted.current.z);
    camera.rotation.set(aim.current.pitch, -aim.current.yaw, 0, "YXZ"); initialized.current = true;
    if (hand.current) {
      hand.current.position.copy(camera.position); hand.current.quaternion.copy(camera.quaternion);
      const bob = Math.sin(performance.now() * 0.009) * (Math.abs(held.current.forward) + Math.abs(held.current.strafe)) * 0.012;
      hand.current.translateY(bob);
      const age = Date.now() + (offset.current ?? 0) - me.lastShotAt;
      const kick = age >= 0 && age < 220 ? Math.sin((1 - age / 220) * Math.PI) : 0;
      if (me.weapon === "knife") { hand.current.rotateX(-kick * 0.75); hand.current.rotateZ(kick * 0.4); }
      else { hand.current.translateZ(kick * 0.08); hand.current.rotateX(kick * 0.045); }
      if (muzzle.current) muzzle.current.visible = me.weapon !== "knife" && age >= 0 && age < 90;
    }
  });
  const weapon = me?.weapon;
  const skin = ["#e98c40", "#f2ede7", "#deb18e", "#dffafa"][avatarId % 4];
  return <group ref={hand}>
    <group position={[0.27, -0.37, -0.42]} rotation={[0.7, 0, -0.08]}>
      <mesh position={[0, -0.1, 0]}><capsuleGeometry args={[0.062, 0.21, 4, 12]}/><meshStandardMaterial color={avatarId % 4 === 2 ? COLORS[avatarId] : skin} roughness={0.7}/></mesh>
      <mesh position={[0, 0.08, -0.01]} scale={[1, 1.1, 0.9]}><sphereGeometry args={[0.075, 16, 12]}/><meshStandardMaterial color={skin} roughness={0.55}/></mesh>
      <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.065, 0.012, 6, 16]}/><meshStandardMaterial color={COLORS[avatarId]}/></mesh>
    </group>
    {weapon && <group position={[0.27, -0.24, -0.53]}>
      <WeaponModel weapon={weapon}/>
      {weapon !== "knife" && <mesh ref={muzzle} visible={false} position={[0, 0, weapon === "pistol" ? -0.3 : weapon === "desert-eagle" ? -0.42 : -0.72]}><octahedronGeometry args={[0.09]}/><meshBasicMaterial color="#fff0a0" toneMapped={false}/></mesh>}
    </group>}
  </group>;
}
function ArenaScene({ state, match, playerId, aim, held, now, offset }: MinigameViewProps & { state: ArenaView; aim: MutableRefObject<Aim>; held: MutableRefObject<ArenaInput>; offset: RefObject<number | null> }) {
  const map = ARENA_MAPS[state.map];
  const me = state.players[playerId], hits = state.hits ?? [];
  return <>
    <ArenaWorld map={map}/><CameraRig state={state} playerId={playerId} avatarId={match.players.find((p) => p.id === playerId)?.avatarId ?? 0} aim={aim} held={held} offset={offset}/>
    {state.pickups.filter((p) => p.availableAt <= now).map((item) => {
      const p = map.pickups[item.id];
      return <WeaponPickup key={item.id} point={p} weapon={p.weapon} label={!!me && Math.abs(me.y - p.y) < 2.2 && Math.hypot(me.x - p.x, me.z - p.z) < 14}/>;
    })}
    {(state.supplies ?? []).filter((s) => s.availableAt <= now).map((s) => <SupplyPickup key={s.id} point={map.supplies[s.id]}/>)}
    {Object.entries(state.players).filter(([id, p]) => id !== playerId && p.hp > 0).map(([id, p]) => {
      const player = match.players.find((o) => o.id === id);
      const color = COLORS[player?.avatarId ?? 0] ?? "#fb9a60";
      return <ArenaCharacter key={id} player={p} name={player?.name ?? "Explorer"} color={color} avatarId={player?.avatarId ?? 0} hit={hits.findLast((hit) => hit.victim === id)} now={now} offset={offset}/>;
    })}
    {hits.filter((hit) => now - hit.at < 650).map((hit) => <HitBurst key={hit.id} hit={hit} offset={offset}/>)}
    {hits.filter((hit) => hit.attacker === playerId && now - hit.at < 1400).map((hit) => <HitDamageNumber key={hit.id} hit={hit}/>)}
    {state.shots.filter((s) => now - s.at < 220 && s.weapon !== "knife").map((s) => <Line key={s.id} points={[[s.from.x, s.from.y, s.from.z], [s.to.x, s.to.y, s.to.z]]} color={WEAPONS[s.weapon].color} lineWidth={2}/>) }
  </>;
}
export default function PickupArenaScreen(props: MinigameViewProps) {
  const { minigame, match, playerId, now, online, sendInput } = props;
  const state = minigame.state as ArenaView, me = state.players[playerId], map = ARENA_MAPS[state.map];
  const offset = useServerOffset(minigame.serverNow);
  const [locked, setLocked] = useState(false), [touchPlaying, setTouchPlaying] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null), keys = useRef(new Set<string>());
  const aim = useRef<Aim>({ yaw: me?.yaw ?? 0, pitch: me?.pitch ?? 0 });
  const touchLook = useRef<[number, number] | null>(null);
  const held = useRef<ArenaInput>({ type: "ARENA_CONTROL", forward: 0, strafe: 0, yaw: 0, pitch: 0, fire: false });
  const sendRef = useRef(sendInput);
  useEffect(() => { sendRef.current = sendInput; }, [sendInput]);
  const active = online && (locked || touchPlaying) && !!me?.hp && now < state.endsAt;
  const changeKey = useCallback((key: string, pressed: boolean) => {
    if (keys.current.has(key) === pressed) return;
    if (pressed) keys.current.add(key); else keys.current.delete(key);
    const input = held.current, set = keys.current;
    input.forward = Number(set.has("w") || set.has("arrowup")) - Number(set.has("s") || set.has("arrowdown"));
    input.strafe = Number(set.has("d") || set.has("arrowright")) - Number(set.has("a") || set.has("arrowleft"));
    if (active) sendRef.current({ ...input, yaw: aim.current.yaw, pitch: aim.current.pitch });
  }, [active]);
  const setFire = useCallback((fire: boolean) => {
    held.current.fire = fire;
    // Send both edges immediately so quick mouse/touch taps survive the input heartbeat.
    if (active) sendRef.current({ ...held.current, yaw: aim.current.yaw, pitch: aim.current.pitch, fire });
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const pressed = keys.current, input = held.current;
    const send = () => {
      input.forward = Number(pressed.has("w") || pressed.has("arrowup")) - Number(pressed.has("s") || pressed.has("arrowdown"));
      input.strafe = Number(pressed.has("d") || pressed.has("arrowright")) - Number(pressed.has("a") || pressed.has("arrowleft"));
      input.yaw = aim.current.yaw; input.pitch = aim.current.pitch;
      sendRef.current({ ...input });
    };
    send(); const timer = window.setInterval(send, 100);
    // The server expires movement after 350 ms. Avoid sending into results or a dead player's phase.
    return () => { clearInterval(timer); pressed.clear(); input.fire = false; input.forward = 0; input.strafe = 0; };
  }, [active]);
  useEffect(() => {
    const turn = (dx: number, dy: number) => {
      const yaw = aim.current.yaw + dx * 0.0025;
      aim.current.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      aim.current.pitch = Math.max(-1.45, Math.min(1.45, aim.current.pitch - dy * 0.0025));
    };
    const mouse = (e: MouseEvent) => { if (document.pointerLockElement === canvas.current) turn(e.movementX, e.movementY); };
    const lock = () => setLocked(document.pointerLockElement === canvas.current);
    const down = (e: KeyboardEvent) => {
      if (!active || e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "e", " "].includes(key)) e.preventDefault();
      changeKey(key, true);
      if (key === "e" && !e.repeat) sendRef.current({ type: "ARENA_PICKUP" });
      if (key === " " && !e.repeat) setFire(true);
    };
    const up = (e: KeyboardEvent) => { changeKey(e.key.toLowerCase(), false); if (e.key === " ") setFire(false); };
    const release = (e: PointerEvent) => { if (e.pointerType === "mouse" && held.current.fire) setFire(false); };
    const blur = () => { keys.current.clear(); if (held.current.fire) setFire(false); };
    document.addEventListener("pointerlockchange", lock); window.addEventListener("mousemove", mouse);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("pointerup", release); window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("pointerlockchange", lock); window.removeEventListener("mousemove", mouse);
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("pointerup", release); window.removeEventListener("blur", blur);
    };
  }, [active, setFire, changeKey]);
  useEffect(() => () => { if (document.pointerLockElement === canvas.current) document.exitPointerLock(); }, []);
  const begin = () => {
    if (window.matchMedia("(pointer: coarse)").matches) { setTouchPlaying(true); return; }
    const request = canvas.current?.requestPointerLock();
    if (request) request.catch(() => setTouchPlaying(true));
  };
  const sorted = Object.entries(state.players).sort((a, b) => b[1].kills - a[1].kills);
  const floor = Math.round((me?.y ?? 0) / 4);
  const nearest = me && state.pickups.find((p) => p.availableAt <= now && Math.hypot(map.pickups[p.id].x - me.x, map.pickups[p.id].y - me.y, map.pickups[p.id].z - me.z) < 1.5);
  const hit = (state.hits ?? []).findLast((h) => h.attacker === playerId && now - h.at < 350);
  const hurt = (state.hits ?? []).findLast((h) => h.victim === playerId && now - h.at < 650);
  return <div className="arena-game">
    <header className="arena-header"><div><span className="pp-eyebrow">{map.name.toUpperCase()}</span><h2>Pickup Shootout</h2></div><strong>{Math.max(0, Math.ceil((state.endsAt - now) / 1000))}s</strong></header>
    <div className="arena-viewport" onPointerDown={(e) => { if (e.pointerType === "mouse" && locked && e.button === 0) setFire(true); }} onContextMenu={(e) => e.preventDefault()}>
      <Canvas camera={{ fov: 78, near: 0.08, far: 100 }} dpr={[1, 1.25]} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { canvas.current = gl.domElement; }} fallback={<p>This arena needs a browser with WebGL enabled.</p>}>
        <ArenaScene {...props} state={state} aim={aim} held={held} offset={offset}/>
      </Canvas>
      <div className="arena-crosshair" aria-hidden="true">+</div>
      {hit && <div key={hit.id} className={`arena-hit-marker ${hit.hpAfter === 0 ? "kill" : ""}`} aria-label={`${hit.damage} damage dealt`}>✕{hit.headshot && <small>HEADSHOT</small>}</div>}
      {hurt && <div key={hurt.id} className="arena-hurt-vignette" aria-hidden="true"/>}
      <ol className="arena-leaderboard">{sorted.map(([id, p]) => <li key={id} className={id === playerId ? "me" : ""}>
        <span>{match.players.find((o) => o.id === id)?.name}</span><b>{p.kills}</b>
      </li>)}</ol>
      <div className="arena-feed" aria-live="polite">{state.feed.filter((f) => now - f.at < 5000).map((f) => <p key={`${f.at}:${f.victim}`}>
        {match.players.find((p) => p.id === f.killer)?.name} · {WEAPONS[f.weapon].name}{f.headshot ? " · HEADSHOT" : ""} · {match.players.find((p) => p.id === f.victim)?.name}
      </p>)}</div>
      <svg className="arena-minimap" viewBox={`${-map.halfSize} ${-map.halfSize} ${map.halfSize * 2} ${map.halfSize * 2}`} role="img" aria-label={`Arena map. Floor ${floor + 1}`}>
        <rect x={-map.halfSize} y={-map.halfSize} width={map.halfSize * 2} height={map.halfSize * 2} fill="#131d2b"/>
        {map.boxes.filter((b) => b.kind !== "wall" && b.y - b.h / 2 <= floor * 4 + 1 && b.y + b.h / 2 > floor * 4).map((b, i) => <rect key={i} x={b.x - b.w / 2} y={b.z - b.d / 2} width={b.w} height={b.d} fill={b.color}/>)}
        {map.stairs.map((s, i) => <rect key={i} x={s.x - s.w / 2} y={s.z - s.length / 2} width={s.w} height={s.length} fill="#8ed5bd"/>)}
        {state.pickups.filter((p) => p.availableAt <= now && map.pickups[p.id].y === floor * 4).map((p) => <circle key={p.id} cx={map.pickups[p.id].x} cy={map.pickups[p.id].z} r="0.65" fill={WEAPONS[map.pickups[p.id].weapon].color}/>)}
        {me && <g transform={`translate(${me.x},${me.z}) rotate(${me.yaw * 180 / Math.PI})`}><path d="M0 -1.4L1 1L-1 1Z" fill="#fff"/></g>}
        {(state.supplies ?? []).filter((s) => s.availableAt <= now && map.supplies[s.id].y === floor * 4).map((s) => <rect key={"s" + s.id} x={map.supplies[s.id].x - .5} y={map.supplies[s.id].z - .5} width={1} height={1} fill={map.supplies[s.id].kind === "health" ? "#ff91a0" : "#ffe19c"}/>)}
      </svg>
      {me && <>
        <div className={`arena-hp-box ${me.hp < 35 ? "low" : ""}`}><span>HEALTH <b>{me.hp}<small> / 100</small></b></span>
          <div role="progressbar" aria-label="Your HP" aria-valuemin={0} aria-valuemax={100} aria-valuenow={me.hp}><i style={{ width: `${me.hp}%` }}/></div>
        </div>
        <div className="arena-status"><span>{me.weapon ? WEAPONS[me.weapon].name : "Unarmed"}</span><b>{me.ammo < 0 ? "∞" : me.ammo} ammo</b><span>{me.kills} kills · floor {floor + 1}</span></div>
      </>}
      {nearest && active && <div className="arena-pickup-prompt">E / Swap · {WEAPONS[map.pickups[nearest.id].weapon].name}</div>}
      {me?.protectedUntil > now && active && <div className="arena-protection">Spawn shield · weapons ready in {Math.ceil((me.protectedUntil - now) / 1000)}s</div>}
      {!me?.hp ? <div className="arena-overlay arena-death" role="status"><span className="arena-death-icon">☠</span><h3>{me ? "ELIMINATED" : "SPECTATING"}</h3><p>{me && state.feed.find((f) => f.victim === playerId) ? "Taken out by " + match.players.find((p) => p.id === state.feed.find((f) => f.victim === playerId)?.killer)?.name : ""}</p><strong>{me?.respawnAt ? `Back in ${Math.max(0, Math.ceil((me.respawnAt - now) / 1000))} seconds` : "Watch the shootout."}</strong><p>Respawn with 100 HP and a short spawn shield.</p></div> :
        !locked && !touchPlaying && <div className="arena-overlay"><span className="pp-eyebrow">FIND · EQUIP · SURVIVE</span><h3>Start with nothing.<br/>Make every pickup count.</h3><p>WASD to move · mouse to look · click to fire · E to swap<br/>1 kill = 1 point · Escape releases your mouse</p><button disabled={!online} onClick={begin}>Enter arena</button></div>}
    </div>
    {touchPlaying && <div className="arena-touch-controls">
      <div className="arena-touch-move" role="group" aria-label="Movement">{[["a", "←"], ["w", "↑"], ["s", "↓"], ["d", "→"]].map(([key, label]) => <button key={key} aria-label={`Move ${label}`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); changeKey(key, true); }}
        onPointerUp={() => changeKey(key, false)} onPointerCancel={() => changeKey(key, false)} onLostPointerCapture={() => changeKey(key, false)}>{label}</button>)}</div>
      <div className="arena-touch-look" aria-label="Drag to look" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); touchLook.current = [e.clientX, e.clientY]; }} onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId) || !touchLook.current) return;
        const [x, y] = touchLook.current, yaw = aim.current.yaw + (e.clientX - x) * 0.006;
        aim.current.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); aim.current.pitch = Math.max(-1.45, Math.min(1.45, aim.current.pitch - (e.clientY - y) * 0.006));
        touchLook.current = [e.clientX, e.clientY];
      }} onLostPointerCapture={() => { touchLook.current = null; }}>Drag to look</div>
      <button className="arena-fire" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFire(true); }} onPointerUp={() => setFire(false)} onPointerCancel={() => setFire(false)} onLostPointerCapture={() => { if (held.current.fire) setFire(false); }}>Fire</button>
      <button disabled={!nearest} onClick={() => sendInput({ type: "ARENA_PICKUP" })}>Swap</button>
      <button onClick={() => setTouchPlaying(false)}>Pause controls</button>
    </div>}
    <p className="arena-help">{map.id === "arcade" ? "Three floors · four mint-marked stairs" : "Buildings, cars and crates provide cover"} · Knife, shotgun, Desert Eagle and other guns · Most kills wins</p>
  </div>;
}
