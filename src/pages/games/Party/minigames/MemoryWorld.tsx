import { useEffect, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrthographicCamera, RoundedBox } from "@react-three/drei";
import { Group, Mesh, OrthographicCamera as ThreeOrthographicCamera } from "three";
import { COLORS } from "../../../../games/party/config.ts";
import { MEMORY_TIMING, type ArrowMemoryView } from "../../../../games/party/minigames/arrowMemory/index.ts";
import type { Player } from "../../../../games/party/types.ts";
import { PartyCharacter } from "./PartyCharacter.tsx";
import { useServerOffset } from "./useServerClock.ts";
import { AtmosphereParticles, Flame, LivingSurface } from "./WorldEffects.tsx";
import { useSceneMotion } from "./useSceneMotion.ts";

function worldPoint(x: number, z: number): [number, number, number] {
  return [(x - 4.5) * 1.12 + (x < 5 ? -0.18 : 0.18), 0, (z - 4.5) * 1.12 + (z < 5 ? -0.18 : 0.18)];
}
function CameraFit({ quadrant }: { quadrant?: number }) {
  const camera = useRef<ThreeOrthographicCamera>(null), size = useThree((state) => state.size);
  const x = quadrant === undefined ? 0 : quadrant % 2 ? 3 : -3;
  const z = quadrant === undefined ? 0 : quadrant < 2 ? -3 : 3;
  useEffect(() => {
    const ortho = camera.current; if (!ortho) return;
    ortho.zoom = Math.min(size.width / (quadrant === undefined ? 16 : 8), size.height / (quadrant === undefined ? 14 : 8));
    ortho.lookAt(x, -0.25, z); ortho.updateProjectionMatrix();
  }, [size, quadrant, x, z]);
  return <OrthographicCamera ref={camera} makeDefault position={[x, 15, z + 16]} near={0.1} far={100}/>;
}

function Tile({ x, z, state, offset }: { x: number; z: number; state: ArrowMemoryView; offset: RefObject<number | null> }) {
  const platform = useRef<Group>(null), icicle = useRef<Group>(null), chips = useRef<Group>(null);
  const ice = state.map === "ice", safe = Object.values(state.safe ?? {}).some((p) => p.x === x && p.z === z);
  const hazard = state.phase === "hazard" || state.phase === "finished", unsafe = hazard && !safe;
  const position = worldPoint(x, z), stagger = (x * 7 + z * 11) % 5 * 0.022;
  useFrame(() => {
    const now = Date.now() + (offset.current ?? 0), group = platform.current;
    if (!group) return;
    const age = Math.max(0, (now - (state.phaseEndsAt - MEMORY_TIMING.hazard)) / 1000 - stagger);
    const fall = unsafe ? Math.max(0, age - (ice ? 0.36 : 0.06)) : 0;
    const restore = state.phase === "restore" ? Math.min(1, Math.max(0, (now - (state.phaseEndsAt - MEMORY_TIMING.restore)) / 420)) : 1;
    group.position.y = -fall * fall * 10 - (1 - restore) * 1.2;
    group.rotation.set(fall * (ice ? 0.3 : 1.1), fall * 0.4, fall * (x % 2 ? 0.45 : -0.45));
    group.scale.setScalar(Math.max(0.001, restore)); group.visible = fall < 1;
    if (icicle.current) { icicle.current.visible = ice && unsafe && age < 0.52; icicle.current.position.y = 6.5 - Math.min(age / 0.4, 1) ** 2 * 7; }
    if (chips.current) {
      const t = age - 0.37; chips.current.visible = ice && unsafe && t > 0 && t < 0.7;
      chips.current.children.forEach((chip, i) => { const angle = i * 2.1; chip.position.set(Math.cos(angle) * t * 2, t * 1.6 - t * t * 8, Math.sin(angle) * t * 2); chip.rotation.set(t * 4, angle, t * 3); });
    }
  });
  return <group position={position}>
    <group ref={platform}>
      <RoundedBox args={[1, ice ? 0.3 : 0.4, 1]} radius={ice ? 0.09 : 0.06} smoothness={2} position={[0, -0.13, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={safe && hazard ? "#8cffcd" : ice ? "#95daed" : "#463847"} roughness={ice ? 0.24 : 0.85} metalness={ice ? 0.18 : 0.12} emissive={safe && hazard ? "#39b988" : ice ? "#1e5268" : "#311626"} emissiveIntensity={safe && hazard ? 0.45 : 0.2}/>
      </RoundedBox>
      {ice ? <>
        <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.81, 0.81]}/><meshStandardMaterial color="#d6f8ff" transparent opacity={0.2} roughness={0.16}/></mesh>
        <Line points={[[-0.35, 0.041, -0.25], [-0.08, 0.041, 0.04], [-0.18, 0.041, 0.32]]} color="#c6f5ff" lineWidth={0.8} transparent opacity={0.6}/>
      </> : <>
        <mesh position={[0, 0.078, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}><ringGeometry args={[0.16, 0.18, 4]}/><meshBasicMaterial color={safe && hazard ? "#9affd2" : "#b95f65"} transparent opacity={0.6}/></mesh>
        <mesh position={[0, -0.34, 0]}><cylinderGeometry args={[0.36, 0.21, 0.3, 5]}/><meshStandardMaterial color="#2d2536" roughness={1}/></mesh>
      </>}
    </group>
    {ice && <>
      <group ref={icicle} visible={false}>
        <mesh rotation={[Math.PI, 0, 0]} castShadow><coneGeometry args={[0.25, 1.45, 5]}/><meshStandardMaterial color="#b5efff" metalness={0.2} roughness={0.18}/></mesh>
        <mesh position={[0.21, 0.25, 0.15]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.12, 0.8, 5]}/><meshStandardMaterial color="#effaff"/></mesh>
      </group>
      <group ref={chips} visible={false}>{[0, 1, 2].map((i) => <mesh key={i}><tetrahedronGeometry args={[0.14]}/><meshStandardMaterial color="#c3f2ff" roughness={0.2}/></mesh>)}</group>
    </>}
  </group>;
}

function MemoryCharacter({ state, player, yours, offset, motion }: { state: ArrowMemoryView; player: Player; yours: boolean; offset: RefObject<number | null>; motion: boolean }) {
  const runner = state.players[player.id], body = useRef<Group>(null), walking = useRef(0), initialized = useRef(false);
  const heading = useRef(Math.PI), ring = useRef<Mesh>(null);
  useFrame((_, dt) => {
    const group = body.current; if (!group) return;
    const now = Date.now() + (offset.current ?? 0), [x, , z] = worldPoint(runner.x, runner.z);
    const dx = x - group.position.x, dz = z - group.position.z, distance = Math.hypot(dx, dz);
    const blend = initialized.current ? 1 - Math.exp(-15 * dt) : 1;
    if (initialized.current && distance > 0.02) heading.current = Math.atan2(-dx, -dz);
    walking.current = initialized.current ? Math.min(1, distance * 6) : 0;
    group.position.x += dx * blend; group.position.z += dz * blend;
    const age = runner.eliminatedAt === null ? 0 : Math.max(0, (now - runner.eliminatedAt) / 1000);
    group.position.y = runner.alive ? 0.055 + Math.sin(Math.min(distance, 1) * Math.PI) * 0.09 : 0.055 - age * age * 5.5;
    group.rotation.y = heading.current;
    group.rotation.z = runner.alive ? 0 : age * 2;
    group.visible = runner.alive || age < 1.1;
    if (ring.current) ring.current.visible = runner.alive;
    initialized.current = true;
  });
  return <group ref={body}>
    <group scale={0.64}><PartyCharacter avatarId={player.avatarId} color={COLORS[player.avatarId]} motion={walking} idle={motion}/></group>
    {yours && <mesh ref={ring} position={[0, 0.036, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.32, 0.39, 32]}/><meshBasicMaterial color="#fff5ca" transparent opacity={0.85}/></mesh>}
    <mesh position={[0, 0.019, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.23, 20]}/><meshBasicMaterial color="#122333" transparent opacity={0.2}/></mesh>
  </group>;
}

function Surroundings({ ice, motion }: { ice: boolean; motion: boolean }) {
  return <>
    {[-1, 1].flatMap((side) => [-6, -2, 3, 7].map((z, i) => <group key={`${side}:${i}`} position={[side * (7.5 + i % 2 * 0.5), -0.9, z]}>
      <mesh rotation={[0, i, 0]} scale={[1.35, ice ? 1.4 : 2.2, 1.2]} castShadow><dodecahedronGeometry args={[1, 0]}/><meshStandardMaterial color={ice ? "#458196" : "#35263d"} roughness={0.9}/></mesh>
      {ice ? <>
        <mesh position={[0, 0.95, 0]} scale={[1.2, 0.35, 1]}><dodecahedronGeometry args={[1, 0]}/><meshStandardMaterial color="#e5f8ff" roughness={0.9}/></mesh>
        <group position={[0.2, 1.25, 0]} rotation={[0, 0, side * 0.14]}>
          <mesh><coneGeometry args={[0.3, 1.8, 5]}/><meshStandardMaterial color="#91e4ff" emissive="#4b859f" emissiveIntensity={0.3} roughness={0.16} metalness={0.15}/></mesh>
          <mesh position={[0.4, -0.2, 0.15]} rotation={[0, 0, -0.3]}><coneGeometry args={[0.17, 1, 5]}/><meshStandardMaterial color="#c8f5ff" roughness={0.2}/></mesh>
        </group>
      </> : <group position={[0, 1.8, 0]}><Flame motion={motion}/></group>}
    </group>))}
    {[-1, 1].map((side) => <group key={side} position={[side * 5.4, -0.6, -7.2]}>
      <mesh scale={[1.3, ice ? 2.4 : 3.1, 1]} rotation={[0, 0.5, 0]}><coneGeometry args={[1.2, 1.8, 5]}/><meshStandardMaterial color={ice ? "#b0e3ef" : "#39273c"} roughness={0.7}/></mesh>
      {!ice && <mesh position={[0, 1.4, 0]} rotation={[0, 0, side * -0.5]}><coneGeometry args={[0.3, 2, 6]}/><meshStandardMaterial color="#a66865" roughness={0.75}/></mesh>}
    </group>)}
    {ice && <mesh position={[0, 6, -11]} rotation={[0, 0, -0.2]}><torusGeometry args={[7, 0.055, 5, 64, Math.PI]}/><meshBasicMaterial color="#90ecd9" transparent opacity={0.45}/></mesh>}
  </>;
}

export function MemoryWorld({ state, players, playerId, serverNow, focused }: { state: ArrowMemoryView; players: Player[]; playerId: string; serverNow?: number; focused: boolean }) {
  const offset = useServerOffset(serverNow), motion = useSceneMotion(), ice = state.map === "ice";
  return <div className="memory-world" role="img" aria-label={`Animated 3D ${ice ? "ice grid above water" : "hell platforms above lava"}. Four private quadrants with fox, bunny, explorer and ghost characters.`}>
    <Canvas orthographic shadows camera={{ position: [0, 18, 14], zoom: 35, near: 0.1, far: 100 }} dpr={[1, 1.5]} gl={{ antialias: true }} fallback={<p className="memory-webgl-fallback">This 3D world needs WebGL enabled in your browser.</p>}>
      <CameraFit quadrant={focused ? state.players[playerId]?.quadrant : undefined}/>
      <color attach="background" args={[ice ? "#102b46" : "#211325"]}/>
      <fog attach="fog" args={[ice ? "#102b46" : "#211325", 27, 48]}/>
      <hemisphereLight args={[ice ? "#b9eaff" : "#cf9adb", ice ? "#16334b" : "#95371e", 1.8]}/>
      <directionalLight position={[-5, 12, 5]} intensity={ice ? 2.8 : 1.8} color={ice ? "#fff9ec" : "#ffe0a6"} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-bias={-0.001}/>
      <pointLight position={[0, ice ? 4 : -0.6, 0]} color={ice ? "#79dfff" : "#ff8036"} intensity={ice ? 10 : 30} distance={18}/>
      <LivingSurface lava={!ice} motion={motion}/><Surroundings ice={ice} motion={motion}/>
      {Array.from({ length: 100 }, (_, i) => <Tile key={i} x={i % 10} z={Math.floor(i / 10)} state={state} offset={offset}/>)}
      {players.filter((p) => state.players[p.id]).map((player) => {
        const p = state.players[player.id], x = p.quadrant % 2 ? 3 : -3, z = p.quadrant < 2 ? -3 : 3;
        const color = COLORS[player.avatarId], yours = player.id === playerId;
        return <group key={player.id}>
          <Line points={[[x - 2.86, 0.09, z - 2.86], [x + 2.86, 0.09, z - 2.86], [x + 2.86, 0.09, z + 2.86], [x - 2.86, 0.09, z + 2.86], [x - 2.86, 0.09, z - 2.86]]} color={yours ? "#fff1bc" : color} lineWidth={yours ? 2 : 1} transparent opacity={p.alive ? 0.85 : 0.2}/>
          <MemoryCharacter state={state} player={player} yours={yours} offset={offset} motion={motion}/>
        </group>;
      })}
      <AtmosphereParticles kind={ice ? "snow" : "embers"} motion={motion}/>
    </Canvas>
    <div className="memory-world-compass" aria-hidden="true"><span>↑ UP</span><small>← LEFT · RIGHT →</small></div>
    <span className="memory-world-caption">{ice ? "FROSTFALL LAGOON" : "THE EMBER VAULT"}</span>
  </div>;
}
