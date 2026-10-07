import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Group, Mesh, MeshBasicMaterial } from "three";
import { PartyCharacter } from "./PartyCharacter.tsx";
import { WEAPONS, type ArenaPoint, type WeaponId } from "../../../../games/party/minigames/pickupArena/maps.ts";
import type { ArenaHit, ArenaPlayer } from "../../../../games/party/minigames/pickupArena/index.ts";

export function WeaponModel({ weapon }: { weapon: WeaponId }) {
  const handgun = weapon === "pistol" || weapon === "desert-eagle";
  const length = weapon === "desert-eagle" ? 0.36 : weapon === "pistol" ? 0.25 : 0.65;
  if (weapon === "knife") return <group>
    <mesh position={[0, 0.17, 0]} rotation={[0, 0, -0.08]}><boxGeometry args={[0.065, 0.3, 0.018]}/><meshStandardMaterial color="#e4f3ff" metalness={0.85} roughness={0.15}/></mesh>
    <mesh><boxGeometry args={[0.075, 0.16, 0.06]}/><meshStandardMaterial color="#424c5b"/></mesh>
    <mesh position={[0, 0.025, 0]}><boxGeometry args={[0.14, 0.02, 0.07]}/><meshStandardMaterial color="#9fb5c9"/></mesh>
  </group>;
  return <group>
    <mesh position={[0, 0, -length / 3]}><boxGeometry args={[weapon === "desert-eagle" ? 0.12 : 0.1, handgun ? 0.115 : 0.13, length]}/><meshStandardMaterial color={weapon === "desert-eagle" ? "#c3cddd" : "#3b4658"} metalness={0.65} roughness={0.3}/></mesh>
    <mesh position={[0, -0.12, 0.03]} rotation={[-0.2, 0, 0]}><boxGeometry args={[0.08, 0.18, 0.1]}/><meshStandardMaterial color="#363642"/></mesh>
    <mesh position={[0, 0.075, -length / 2]}><boxGeometry args={[0.025, 0.035, 0.035]}/><meshStandardMaterial color={WEAPONS[weapon].color}/></mesh>
    {!handgun && <mesh position={[0, 0, -length * 0.7]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.32, 8]}/><meshStandardMaterial color="#8d9aa9" metalness={0.7}/></mesh>}
    {weapon === "shotgun" && <mesh position={[0, -0.055, -0.3]}><boxGeometry args={[0.16, 0.11, 0.22]}/><meshStandardMaterial color="#ad7251"/></mesh>}
  </group>;
}

export function WeaponPickup({ point, weapon, label }: { point: ArenaPoint; weapon: WeaponId; label: boolean }) {
  const display = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (display.current) { display.current.rotation.y = clock.elapsedTime * 0.7; display.current.position.y = 0.58 + Math.sin(clock.elapsedTime * 2) * 0.08; }
  });
  return <group position={[point.x, point.y, point.z]}>
    <group ref={display} scale={1.35}><WeaponModel weapon={weapon}/></group>
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.42, 0.65, 24]}/><meshBasicMaterial color={WEAPONS[weapon].color} transparent opacity={0.8}/></mesh>
    {label && <Html center position={[0, 0.35, 0]} distanceFactor={4} occlude zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
      <span className="arena-world-pickup" style={{ borderColor: WEAPONS[weapon].color }}>{WEAPONS[weapon].name}</span>
    </Html>}
  </group>;
}

export function ArenaCharacter({ player, name, color, avatarId, hit, now, offset }: { player: ArenaPlayer; name: string; color: string; avatarId: number; hit?: ArenaHit; now: number; offset: RefObject<number | null> }) {
  const body = useRef<Group>(null), walking = useRef(0), initialized = useRef(false);
  useFrame((_, dt) => {
    const group = body.current; if (!group) return;
    const blend = initialized.current ? 1 - Math.exp(-20 * dt) : 1;
    walking.current = initialized.current ? Math.min(1, Math.hypot(player.x - group.position.x, player.z - group.position.z) * 3) : 0;
    group.position.x += (player.x - group.position.x) * blend;
    group.position.y += (player.y - group.position.y) * blend;
    group.position.z += (player.z - group.position.z) * blend;
    group.rotation.y = -player.yaw;
    const age = hit ? Date.now() + (offset.current ?? 0) - hit.at : Infinity;
    const recoil = age >= 0 && age < 350 ? Math.sin(age / 350 * Math.PI) : 0;
    group.rotation.z = recoil * 0.16;
    initialized.current = true;
  });
  return <group ref={body}>
    <PartyCharacter avatarId={avatarId} color={color} motion={walking} hitAt={hit?.at} offset={offset}/>
    {player.weapon && <group position={[0.35, 1.1, -0.2]}><WeaponModel weapon={player.weapon}/></group>}
    {player.protectedUntil > now && <mesh position={[0, 1, 0]}><sphereGeometry args={[1, 12, 8]}/><meshBasicMaterial color="#79d8ff" wireframe transparent opacity={0.18}/></mesh>}
    <Html center position={[0, 2.5, 0]} distanceFactor={8} occlude zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
      <div className="arena-enemy-hp"><span>{name} <b>{player.hp} HP</b></span><div><i style={{ width: `${player.hp}%`, background: player.hp < 35 ? "#ff7489" : "#82e5bc" }}/></div></div>
    </Html>
  </group>;
}

export function HitBurst({ hit, offset }: { hit: ArenaHit; offset: RefObject<number | null> }) {
  const sparks = useRef<Group>(null);
  useFrame(() => {
    const age = Math.max(0, (Date.now() + (offset.current ?? 0) - hit.at) / 1000), group = sparks.current;
    if (!group) return;
    group.visible = age < 0.65;
    group.children.forEach((child, i) => {
      const spark = child as Mesh, angle = i * 2.399 + hit.id, speed = 1.2 + (i % 3) * 0.65;
      spark.position.set(Math.cos(angle) * age * speed, age * (1 + i % 4 * 0.35) - age * age * 4, Math.sin(angle) * age * speed);
      spark.scale.setScalar(Math.max(0.05, 1 - age / 0.65));
      (spark.material as MeshBasicMaterial).opacity = Math.max(0, 1 - age / 0.65);
    });
  });
  return <group ref={sparks} position={[hit.position.x, hit.position.y, hit.position.z]}>
    {Array.from({ length: 9 }, (_, i) => <mesh key={i}><octahedronGeometry args={[0.055]}/><meshBasicMaterial color={hit.hpAfter === 0 ? "#ffd78b" : i % 2 ? "#ffb29b" : "#fff6b9"} transparent toneMapped={false}/></mesh>)}
  </group>;
}

export function HitDamageNumber({ hit }: { hit: ArenaHit }) {
  return <Html center position={[hit.position.x, hit.position.y + 0.7, hit.position.z]} distanceFactor={8} zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
    <span className={`arena-damage-number ${hit.hpAfter === 0 ? "kill" : ""}`}>{hit.headshot && <small>HEADSHOT</small>}−{hit.damage}</span>
  </Html>;
}
export function SupplyPickup({ point }: { point: ArenaPoint & { kind: "health" | "ammo" } }) {
  const root = useRef<Group>(null), health = point.kind === "health";
  useFrame(({ clock }) => { if (root.current) { root.current.rotation.y = clock.elapsedTime * .65; root.current.position.y = point.y + .5 + Math.sin(clock.elapsedTime * 2 + point.x) * .06; } });
  return <group ref={root} position={[point.x, point.y + .5, point.z]}>
    <mesh><boxGeometry args={[.6, .4, .4]}/><meshStandardMaterial color={health ? "#f6edf0" : "#707d61"} roughness={.6}/></mesh>
    {health ? <group position={[0, 0, .205]}><mesh><boxGeometry args={[.1, .27, .02]}/><meshStandardMaterial color="#fa637f" emissive="#ee657d" emissiveIntensity={.3}/></mesh><mesh><boxGeometry args={[.27, .1, .02]}/><meshStandardMaterial color="#fa637f"/></mesh></group>
      : [-.15, 0, .15].map((x) => <mesh key={x} position={[x, .07, .22]}><capsuleGeometry args={[.034, .18, 2, 6]}/><meshStandardMaterial color="#ffd285" metalness={.6}/></mesh>)}
    <mesh position={[0, -.38, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.35, .39, 20]}/><meshBasicMaterial color={health ? "#ff91a8" : "#ffdb94"}/></mesh>
  </group>;
}
