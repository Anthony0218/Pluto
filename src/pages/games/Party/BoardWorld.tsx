import { routePreview } from "../../../games/party/engine/routePreview.ts";
import { memo, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Group, Mesh, OrthographicCamera as Camera, Vector3 } from "three";
import type { BoardMap, Match } from "../../../games/party/types.ts";
import type { BoardOverlay } from "../../../games/party/board/renderer.ts";
import { activePlayer, legalPaths } from "../../../games/party/engine/engine.ts";
import { COLORS } from "../../../games/party/config.ts";
import { PartyCharacter } from "./minigames/PartyCharacter.tsx";
import { LivingSurface, AtmosphereParticles, Flame } from "./minigames/WorldEffects.tsx";
import { useSceneMotion } from "./minigames/useSceneMotion.ts";
import { BoardField, BoardFieldResources, LandingEffects } from "./BoardFields.tsx";
import type { BoardLanding } from "../../../games/party/board/fieldDesign.ts";

function height(map: BoardMap, region: number) { return map.theme === "mountain" ? [0, .8, .8, 1.6, 2.1, 3, 3, 4][region] : .35; }
function point(map: BoardMap, n: { x: number; y: number; region: number }): [number, number, number] {
  return [(n.x - map.size.width / 2) / 40, height(map, n.region) + .17, (n.y - map.size.height / 2) / 40];
}
function Tree({ position, pine = false, scale = 1 }: { position: [number, number, number]; pine?: boolean; scale?: number }) {
  return <group position={position} scale={scale}>
    <mesh position={[0, .7, 0]} rotation={[0, 0, pine ? 0 : -.12]}><cylinderGeometry args={[.07, .13, 1.4, 7]}/><meshStandardMaterial color="#866247"/></mesh>
    {pine ? [0, 1, 2].map((i) => <mesh key={i} position={[0, .8 + i * .38, 0]}><coneGeometry args={[.55 - i * .12, .9, 7]}/><meshStandardMaterial color={i === 2 ? "#b4dad3" : "#438875"}/></mesh>) : Array.from({ length: 6 }, (_, i) => <group key={i} rotation={[0, i * Math.PI / 3, 0]} position={[0, 1.42, 0]}>
      <mesh position={[.43, -.07, 0]} rotation={[0, 0, -.2]} scale={[.7, .08, .2]}><sphereGeometry args={[1, 8, 6]}/><meshStandardMaterial color={i % 2 ? "#5ab890" : "#85cd86"}/></mesh>
    </group>)}
  </group>;
}
function Hut({ color = "#ffbd80", tent = false }: { color?: string; tent?: boolean }) {
  return <group>
    {!tent && <mesh position={[0, .38, 0]}><boxGeometry args={[1.05, .75, .85]}/><meshStandardMaterial color={color}/></mesh>}
    <mesh position={[0, tent ? .48 : .96, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.3, 1, 1]}><coneGeometry args={[.95, tent ? 1 : .55, 4]}/><meshStandardMaterial color={tent ? color : "#956963"}/></mesh>
    <mesh position={[0, .27, -.44]}><boxGeometry args={[.29, .5, .025]}/><meshStandardMaterial color="#304c58"/></mesh>
    {!tent && <mesh position={[.35, .46, -.44]}><boxGeometry args={[.22, .24, .03]}/><meshStandardMaterial color="#fff1b8" emissive="#b68140" emissiveIntensity={.4}/></mesh>}
  </group>;
}
function Boat({ motion }: { motion: boolean }) {
  const root = useRef<Group>(null);
  useFrame(({ clock }) => { if (root.current && motion) { root.current.rotation.z = Math.sin(clock.elapsedTime * 1.2) * .035; root.current.position.y = .1 + Math.sin(clock.elapsedTime) * .04; } });
  return <group ref={root} rotation={[0, -.45, 0]}>
    <mesh scale={[1.5, .35, .6]}><sphereGeometry args={[1, 10, 6]}/><meshStandardMaterial color="#a57046"/></mesh>
    <mesh position={[0, .25, 0]}><boxGeometry args={[2.1, .08, .7]}/><meshStandardMaterial color="#e8b77c"/></mesh>
    <mesh position={[0, 1.08, 0]}><cylinderGeometry args={[.04, .05, 1.65, 8]}/><meshStandardMaterial color="#735541"/></mesh>
    <mesh position={[.38, 1.32, 0]} rotation={[0, 0, -.1]}><planeGeometry args={[.7, 1.05]}/><meshStandardMaterial color="#f5ecd5" side={2}/></mesh>
    <mesh position={[0, 2.05, 0]}><boxGeometry args={[.45, .22, .025]}/><meshStandardMaterial color="#35475d"/></mesh>
  </group>;
}
function Landmark({ map, region, motion }: { map: BoardMap; region: number; motion: boolean }) {
  const motif = map.regions[region].motif;
  if (motif === "volcano") return <group>
    <mesh position={[0, .8, 0]}><coneGeometry args={[1.3, 1.65, 8]}/><meshStandardMaterial color="#7e7877"/></mesh>
    <mesh position={[0, 1.59, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.29, 16]}/><meshStandardMaterial color="#ff9e52" emissive="#fc7049" emissiveIntensity={2}/></mesh>
    <group position={[0, 1.8, 0]} scale={.45}><Flame motion={motion}/></group>
  </group>;
  if (motif === "temple") return <group>
    {[0, 1, 2].map((i) => <mesh key={i} position={[0, .13 + i * .22, 0]}><boxGeometry args={[1.7 - i * .4, .23, 1.5 - i * .35]}/><meshStandardMaterial color={["#6c9690", "#83aaa0", "#aec4ac"][i]}/></mesh>)}
    <mesh position={[0, 1, 0]}><boxGeometry args={[.6, .7, .5]}/><meshStandardMaterial color="#afd5b0"/></mesh>
    <mesh position={[0, 1.12, -.26]}><sphereGeometry args={[.12, 8, 6]}/><meshStandardMaterial color="#fff2a4" emissive="#f8bd64" emissiveIntensity={1.5}/></mesh>
  </group>;
  if (motif === "boat") return <Boat motion={motion}/>;
  if (motif === "village") return <group><Hut/><group position={[1.2, 0, .55]} scale={.65}><Hut color="#93bfd0"/></group></group>;
  if (motif === "mine" || motif === "cave") return <group>
    <mesh position={[0, .55, .2]}><dodecahedronGeometry args={[1.3, 0]}/><meshStandardMaterial color={motif === "mine" ? "#7e8492" : "#99d6e3"}/></mesh>
    <mesh position={[0, .44, -.91]}><circleGeometry args={[.48, 12]}/><meshStandardMaterial color="#233849"/></mesh>
    {[-1, 1].map((side) => <mesh key={side} position={[side * .53, .45, -.96]}><boxGeometry args={[.16, .85, .16]}/><meshStandardMaterial color="#a48562"/></mesh>)}
    <mesh position={[0, .88, -.97]}><boxGeometry args={[1.2, .15, .2]}/><meshStandardMaterial color="#bfa175"/></mesh>
    <mesh position={[0, .1, -1.2]}><boxGeometry args={[.5, .28, .4]}/><meshStandardMaterial color="#9aa8b1"/></mesh>
  </group>;
  if (motif === "lake") return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .08, 0]}><circleGeometry args={[1.15, 24]}/><meshStandardMaterial color="#80d1eb" metalness={.2} roughness={.2}/></mesh>
    <mesh position={[.3, .3, -.2]}><coneGeometry args={[.19, .62, 5]}/><meshStandardMaterial color="#d5f7ff"/></mesh>
    <group position={[-.7, 0, -.4]} scale={.55}><Hut tent color="#e69c7f"/></group>
  </group>;
  if (motif === "summit" || motif === "cliff") return <group>
    <mesh position={[0, .65, .1]}><coneGeometry args={[1.2, 1.7, 6]}/><meshStandardMaterial color="#829cae"/></mesh>
    <mesh position={[0, 1.32, .1]}><coneGeometry args={[.57, .8, 6]}/><meshStandardMaterial color="#e9f6ff"/></mesh>
    <mesh position={[.7, .9, -.4]}><cylinderGeometry args={[.024, .024, 1.8, 7]}/><meshStandardMaterial color="#667f94"/></mesh>
    <mesh position={[.92, 1.5, -.4]}><planeGeometry args={[.45, .25]}/><meshStandardMaterial color="#ffb269" side={2}/></mesh>
  </group>;
  if (motif === "bridge") return <group><group position={[-.7, 0, 0]}><Hut tent color="#e0a56c"/></group><Tree pine position={[.7, 0, .6]} scale={.75}/></group>;
  if (motif === "forest") return <group><Tree pine position={[-.45, 0, -.25]}/><Tree pine position={[.65, 0, .45]} scale={.8}/></group>;
  return region === 1 ? <group><Hut color="#f5bf8e"/><mesh position={[0, .65, -.8]}><boxGeometry args={[1.3, .15, .65]}/><meshStandardMaterial color="#e77993"/></mesh><Tree position={[.9, 0, .55]} scale={.75}/></group>
    : <group><Tree position={[-.35, 0, -.3]}/><Tree position={[.65, 0, .4]} scale={.8}/>{region === 0 && <group position={[-.75, 0, .7]} scale={.48}><Hut color="#9bcddc"/></group>}</group>;
}
const Scenery = memo(function Scenery({ map, preview }: { map: BoardMap; preview: boolean }) {
  const motion = useSceneMotion(), mountain = map.theme === "mountain";
  return <>
    <color attach="background" args={[mountain ? "#c4e0ec" : "#9cdad9"]}/>
    <hemisphereLight args={["#fff6df", mountain ? "#6e9dba" : "#4d9c9a", 2.1]}/><directionalLight position={[-12, 22, 9]} intensity={2.8} color="#fff2d6"/>
    <group position={[0, mountain ? -1.4 : -.55, 0]} scale={[8, 1, 8]}><LivingSurface lava={false} motion={motion && !preview}/></group>
    {map.regions.map((r, i) => {
      const x = (r.x - map.size.width / 2) / 40, z = (r.y - map.size.height / 2) / 40, y = height(map, i);
      const nodes = map.nodes.filter((n) => n.region === i);
      const rx = Math.max(3.1, ...nodes.map((n) => Math.abs(n.x - r.x) / 40 + .6));
      const rz = Math.max(2.8, ...nodes.map((n) => Math.abs(n.y - r.y) / 40 + .6));
      return <group key={r.name} position={[x, y, z]}>
        <mesh position={[0, -.7, 0]} scale={[rx, 1, rz]}><cylinderGeometry args={[1, .8, 1.4, 20]}/><meshStandardMaterial color={mountain ? "#718994" : "#bfa27b"} flatShading/></mesh>
        <mesh position={[0, -.1, 0]} scale={[rx, 1, rz]}><cylinderGeometry args={[1.04, 1.03, .22, 24]}/><meshStandardMaterial color={mountain && i >= 3 ? "#d9edf1" : mountain ? "#a7c199" : "#eacb96"}/></mesh>
        <mesh position={[0, .015, 0]} scale={[rx * .94, 1, rz * .91]}><cylinderGeometry args={[1, 1, .13, 24]}/><meshStandardMaterial color={r.color} roughness={.92}/></mesh>
        <Landmark map={map} region={i} motion={motion && !preview}/>
        {[0, 1, 2].map((j) => <Tree key={j} pine={mountain} scale={.6 + j * .13} position={[Math.cos(j * 2.2 + i) * rx * .8, .09, Math.sin(j * 2.2 + i) * rz * .8]}/>)}
        {!preview && <Html position={[0, .3, rz + .3]} center style={{ pointerEvents: "none" }}><span className="pp-world-label">{r.name}</span></Html>}
      </group>;
    })}
    {!preview && <AtmosphereParticles kind={mountain ? "snow" : "dust"} motion={motion} area={32}/>}
  </>;
});
function Pluto({ position, animate }: { position: [number, number, number]; animate: boolean }) {
  const root = useRef<Group>(null);
  useFrame(({ clock }) => { if (root.current && animate) { root.current.rotation.y = clock.elapsedTime; root.current.position.y = position[1] + .7 + Math.sin(clock.elapsedTime * 2) * .09; } });
  return <group ref={root} position={[position[0], position[1] + .7, position[2]]}>
    <mesh rotation={[0, 0, Math.PI / 4]}><sphereGeometry args={[.32, 16, 12]}/><meshStandardMaterial color="#ffe08d" emissive="#eca947" emissiveIntensity={.55} metalness={.6} roughness={.2}/></mesh>
    <mesh rotation={[Math.PI / 2.7, 0, .2]}><torusGeometry args={[.54, .035, 6, 32]}/><meshStandardMaterial color="#ffecad" emissive="#eab765" emissiveIntensity={.8}/></mesh>
    <mesh position={[.53, .1, .08]}><sphereGeometry args={[.07, 8, 6]}/><meshStandardMaterial color="#fff5cd"/></mesh>
    <mesh position={[.12, .1, .285]} scale={[1, .7, .25]}><sphereGeometry args={[.09, 8, 6]}/><meshStandardMaterial color="#edb94f"/></mesh>
  </group>;
}
function Pawn({ target, avatarId, color, active, landing, animate }: { target: [number, number, number]; avatarId: number; color: string; active: boolean; landing: BoardLanding | null; animate: boolean }) {
  const root = useRef<Group>(null), pose = useRef<Group>(null), motion = useRef(0);
  const materials = useRef<{ material: import("three").Material; opacity: number; transparent: boolean }[]>([]);
  const [initial] = useState(() => target);
  useFrame((_, dt) => {
    const g = root.current; if (!g) return; const dx = target[0] - g.position.x, dz = target[2] - g.position.z;
    if (!materials.current.length) g.traverse((object) => { if (object instanceof Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.current.push({ material, opacity: material.opacity, transparent: material.transparent }); });
    motion.current = Math.min(1, Math.hypot(dx, dz) * 2);
    if (motion.current > .05) g.rotation.y = Math.atan2(-dx, -dz);
    const age = landing ? (performance.now() - landing.startedAt) / 1000 : 9;
    const warp = landing?.kind === "warp" && landing.targetNodeId;
    const fading = warp && animate && age < 1;
    if (warp) { if (!fading || age >= .45) g.position.set(...target); }
    else g.position.lerp(new Vector3(...target), 1 - Math.exp(-9 * dt));
    const opacity = fading ? age < .45 ? Math.max(0, 1 - age / .45) : Math.min(1, (age - .45) / .55) : 1;
    for (const entry of materials.current) { entry.material.opacity = entry.opacity * opacity; entry.material.transparent = opacity < 1 || entry.transparent; }
    if (pose.current) pose.current.rotation.z = animate && landing?.kind === "hazard" && age < .5 ? Math.sin(age * 30) * .18 * (1 - age / .5) : 0;
  });
  return <group ref={root} position={initial}>
    <group ref={pose} scale={.49}><PartyCharacter avatarId={avatarId} color={color} motion={motion}/></group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .025, 0]}><ringGeometry args={[.22, active ? .36 : .29, 20]}/><meshBasicMaterial color={active ? "#fff2a8" : color}/></mesh>
  </group>;
}
function BoardCamera({ map, focus, zoom, cameraReset, overview }: { map: BoardMap; focus: string | null; zoom: number; cameraReset: string; overview: boolean }) {
  const camera = useRef<Camera>(null), controls = useRef<ComponentRef<typeof OrbitControls>>(null), size = useThree((s) => s.size);
  const goal = useRef<Vector3 | null>(null);
  const cameraZoom = Math.min(size.width / 35, size.height / (map.theme === "mountain" ? 33 : 27)) * zoom * (overview && size.height <= 600 ? .65 : 1);
  // The overview sits below the board controls so even the mountain summit remains visible.
  const overviewLift = overview && cameraZoom > 0 ? Math.min(70, size.height * .15) / (cameraZoom * Math.SQRT1_2) : 0;
  useEffect(() => { const n = map.nodes.find((n) => n.id === focus); goal.current = n ? new Vector3(...point(map, n)) : new Vector3(0, 1 + overviewLift, 0); }, [focus, map, cameraReset, overviewLift]);
  useEffect(() => { if (camera.current && controls.current) { camera.current.position.copy(controls.current.target).add(new Vector3(0, 23, 23)); controls.current.update(); } }, [cameraReset]);
  useEffect(() => { if (camera.current) { camera.current.zoom = cameraZoom; camera.current.updateProjectionMatrix(); } }, [cameraZoom]);
  useFrame((_, dt) => {
    if (!goal.current || !controls.current || !camera.current) return;
    const delta = goal.current.clone().sub(controls.current.target).multiplyScalar(1 - Math.exp(-5 * dt));
    controls.current.target.add(delta); camera.current.position.add(delta); controls.current.update();
    if (delta.length() < .001) goal.current = null;
  });
  return <><OrthographicCamera ref={camera} makeDefault position={[0, 23, 23]} near={.1} far={150}/><OrbitControls ref={controls} makeDefault minPolarAngle={.2} maxPolarAngle={Math.PI / 2.2} enableDamping onStart={() => { goal.current = null; }} minZoom={6} maxZoom={95}/></>;
}
function PathArrow({ from, to, label, onSelect, onHover }: { from: [number, number, number]; to: [number, number, number]; label: string; onSelect: () => void; onHover: (hover: boolean) => void }) {
  const button = useRef<HTMLButtonElement>(null), camera = useThree((s) => s.camera);
  useFrame(() => { if (!button.current) return; const a = new Vector3(...from).project(camera), b = new Vector3(...to).project(camera); button.current.style.setProperty("--arrow-angle", `${Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI}deg`); });
  return <Html position={[from[0] + (to[0] - from[0]) * .8, Math.max(from[1], to[1]) + .6, from[2] + (to[2] - from[2]) * .8]} center zIndexRange={[15, 13]}><button ref={button} className="pp-map-path-arrow" aria-label={label} title={label} onPointerEnter={() => onHover(true)} onPointerLeave={() => onHover(false)} onFocus={() => onHover(true)} onBlur={() => onHover(false)} onClick={(e) => { e.stopPropagation(); onSelect(); }}><span>➜</span><small>{label.split(";")[0].replace(/^Space \d+: /, "")}{label.includes(";") ? " · more landings" : ""}</small></button></Html>;
}
function MapEventMarker({ position, text, showLabel = true, labelOnly = false, color }: { position: [number, number, number]; text: string; showLabel?: boolean; labelOnly?: boolean; color?: string }) {
  const root = useRef<Group>(null), motion = useSceneMotion();
  useFrame(({ clock }) => { if (root.current && motion) root.current.position.y = position[1] + .3 + Math.sin(clock.elapsedTime * 3) * .12; });
  return <group ref={root} position={position}>{!labelOnly && <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.5, .7, 32]}/><meshBasicMaterial color={color ?? (text.includes("⚠") ? "#ff866d" : "#ffe191")} transparent opacity={.7}/></mesh>}{showLabel && <Html position={[0, labelOnly ? 2.2 : 1.05, 0]} center style={{ pointerEvents: "none" }}><span className="pp-map-event-marker">{text}</span></Html>}</group>;
}
export function BoardWorld({ map, match, overlay, preview, onSelect, focus, zoom, cameraReset, overview, landing, onProjectReward, explosion }: { map: BoardMap; match: Match | null; overlay: BoardOverlay | null; preview: boolean; onSelect: (id: string) => void; focus: string | null; zoom: number; cameraReset: string; overview: boolean; landing: BoardLanding | null; onProjectReward: (x: number, y: number) => void; explosion: { id: number; nodeId: string; kind: "melon" | "fallout" } | null }) {
  const paths = new Set(match?.phase === "PATH_SELECTION" ? legalPaths(match, map) : []), motion = useSceneMotion();
  const byId = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map]);
  const activeId = match ? activePlayer(match).id : null;
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const route = match?.phase === "PATH_SELECTION" && hoveredPath && paths.has(hoveredPath) ? routePreview(match, map, hoveredPath) : null;
  const activeNode = match && byId.get(activePlayer(match).currentNodeId);
  return <>
    <BoardCamera map={map} focus={focus} zoom={zoom} cameraReset={cameraReset} overview={overview}/><Scenery map={map} preview={preview}/>
    {map.nodes.flatMap((a) => a.connections.filter((id) => id > a.id).map((id) => {
      const b = byId.get(id)!;
      const blocked = match?.blockedConnections.some((c) => (c.fromNodeId === a.id && c.toNodeId === id) || (c.fromNodeId === id && c.toNodeId === a.id));
      return <Line key={a.id + ":" + id} points={[point(map, a), point(map, b)]} color={blocked ? "#ec6d72" : a.region === b.region ? "#f9e6bc" : "#d1b68b"} lineWidth={a.region === b.region ? 5 : 8} dashed={!!blocked} dashSize={.15} gapSize={.13}/>;
    }))}
    <BoardFieldResources>{map.nodes.map((n) => <BoardField key={n.id} node={n} map={map} position={point(map, n)} selected={overlay?.selected === n.id} reachable={paths.has(n.id) || !!route?.landings.includes(n.id)} hot={!!match?.radiationZones.some((z) => z.nodeIds.includes(n.id))} amount={overlay?.damage.get(n.id) ?? 0} onSelect={onSelect} landing={landing?.nodeId === n.id ? landing : null} motion={motion && !preview} eventActive={!!match?.boardEffects?.some((e) => e.nodeIds.includes(n.id))}/>)}</BoardFieldResources>
    {landing && byId.has(landing.nodeId) && <LandingEffects key={landing.id} landing={landing} position={point(map, byId.get(landing.nodeId)!)} motion={motion} onProject={onProjectReward}/>}
    {landing?.targetNodeId && byId.has(landing.targetNodeId) && <LandingEffects key={landing.id + "arrival"} landing={{ ...landing, label: "Arrived!" }} position={point(map, byId.get(landing.targetNodeId)!)} motion={motion} onProject={() => {}}/>}
    {match?.phase === "PATH_SELECTION" && activeNode && [...paths].map((id) => { const preview = routePreview(match, map, id); return <PathArrow key={id} from={point(map, activeNode)} to={point(map, byId.get(id)!)} label={preview.summaries.join("; ")} onSelect={() => onSelect(id)} onHover={(hover) => setHoveredPath(hover ? id : null)}/>; })}
    {match?.boardEffects?.flatMap((effect) => {
      const label = ({ treasure: "💎 +5", eruption: "⚠ −10 HP", breeze: "🍃 +2", sanctuary: "💚 +5 HP", sale: "🛍 −2 coins", relic: "◆ ITEM" })[effect.kind];
      const color = ({ treasure: "#ffe191", eruption: "#ff866d", breeze: "#b7f38c", sanctuary: "#80f3db", sale: "#d9a6ff", relic: "#99caff" })[effect.kind];
      const nodes = effect.nodeIds.filter((id) => byId.has(id));
      const region = nodes.length ? byId.get(nodes[0])!.region : null;
      return [
        ...nodes.map((id) => <MapEventMarker key={effect.id + id} position={point(map, byId.get(id)!)} text={label} showLabel={false} color={color}/>),
        ...(region === null ? [] : [<MapEventMarker key={effect.id + "label"} position={point(map, { ...map.regions[region], region })} text={label + (effect.kind === "eruption" ? ` · END R${effect.expiresAfterRound}` : ` · THROUGH R${effect.expiresAfterRound}`)} labelOnly/>]),
      ];
    })}
    {match?.blockedConnections.map((closure) => byId.has(closure.fromNodeId) && <MapEventMarker key={closure.id} position={point(map, byId.get(closure.fromNodeId)!)} text={`⚠ PATH CLOSED · THROUGH R${closure.expiresAfterRound}`}/>)}
    {match?.transportOutages.flatMap((outage) => {
      const transport = map.transports?.find((t) => t.id === outage.transportId);
      return transport?.endpoints.map((id) => <MapEventMarker key={outage.transportId + id} position={point(map, byId.get(id)!)} text={`⚠ ${transport.name} CLOSED · THROUGH R${outage.expiresAfterRound}`}/>) ?? [];
    })}
    {(match?.plutoNodeIds ?? []).map((id) => <Pluto key={id} position={point(map, byId.get(id)!)} animate={motion && !preview}/>)}
    {match?.properties.map((property) => { const n = byId.get(property.nodeId); if (!n) return null; const p = point(map, n); const owner = match.players.find((p) => p.id === property.ownerPlayerId);
      return <group key={property.nodeId} position={[p[0] + .42, p[1], p[2] + .25]} scale={.35 + property.level * .025}><Hut color={COLORS[owner?.avatarId ?? 0]} tent={map.theme === "mountain"}/></group>; })}
    {match?.players.map((p, i) => { const node = byId.get(p.currentNodeId); if (!node) return null; const position = point(map, node); const crowd = match.players.filter((o) => o.currentNodeId === p.currentNodeId).length > 1;
      position[0] += crowd ? Math.cos(i * Math.PI / 2) * .28 : 0; position[2] += crowd ? Math.sin(i * Math.PI / 2) * .28 : 0; position[1] += .1;
      return <Pawn key={p.id} target={position} avatarId={p.avatarId} color={COLORS[p.avatarId]} active={p.id === activeId} landing={landing?.playerId === p.id ? landing : null} animate={motion}/>; })}
    {match?.animals.map((a) => { const n = byId.get(a.currentNodeId); if (!n) return null; const p = point(map, n); return <group key={a.id} position={[p[0] - .3, p[1], p[2] - .35]} scale={.27}><PartyCharacter avatarId={0} color="#ede7bd"/></group>; })}
    {explosion && byId.has(explosion.nodeId) && <Html key={explosion.id} position={point(map, byId.get(explosion.nodeId)!)} center style={{ pointerEvents: "none" }}><span className="pp-world-explosion">{explosion.kind === "fallout" ? "☢" : "✹"}</span></Html>}
  </>;
}
