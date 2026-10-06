import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MeshStandardMaterial } from "three";
import { CHARACTER_VARIANTS } from "./characterRoster.ts";

function Eyes({ ghost = false }: { ghost?: boolean }) {
  return <group>
    {[-1, 1].map((side) => <group key={side} position={[side * 0.145, ghost ? 0.04 : 0.055, -0.345]}>
      <mesh scale={[0.075, ghost ? 0.12 : 0.09, 0.035]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#152638" roughness={0.25}/></mesh>
      <mesh position={[-0.016, 0.03, -0.032]}><sphereGeometry args={[0.022, 8, 6]}/><meshBasicMaterial color="#fff"/></mesh>
    </group>)}
    {ghost && <mesh position={[0, -0.16, -0.38]} scale={[0.055, 0.075, 0.025]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#27364e"/></mesh>}
  </group>;
}

// All four original models share the same feet origin and a compact silhouette. Motion is driven
// through refs, keeping frame updates out of React and independent of the authoritative game state.
export function PartyCharacter({ avatarId, color, motion, hitAt, offset, idle = true }: {
  avatarId: number; color: string; motion?: RefObject<number>; hitAt?: number;
  offset?: RefObject<number | null>; idle?: boolean;
}) {
  const variant = CHARACTER_VARIANTS[avatarId % CHARACTER_VARIANTS.length] ?? "human";
  const root = useRef<Group>(null), head = useRef<Group>(null), eyes = useRef<Group>(null);
  const leftArm = useRef<Group>(null), rightArm = useRef<Group>(null);
  const leftFoot = useRef<Group>(null), rightFoot = useRef<Group>(null), tail = useRef<Group>(null);
  const fabric = useRef<MeshStandardMaterial>(null);
  const animal = variant === "fox" || variant === "bunny", ghost = variant === "ghost";
  const skin = variant === "fox" ? "#e98c40" : variant === "bunny" ? "#f2ede7" : ghost ? "#dffafa" : "#deb18e";
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + avatarId * 1.7, walking = Math.min(1, motion?.current ?? 0);
    const stride = Math.sin(t * 12) * walking;
    if (root.current) root.current.position.y = ghost ? 0.09 + (idle ? Math.sin(t * 2.2) * 0.075 : 0) : idle ? Math.sin(t * 2.3) * 0.016 + Math.abs(stride) * 0.035 : 0;
    if (leftFoot.current) leftFoot.current.rotation.x = stride * 0.48;
    if (rightFoot.current) rightFoot.current.rotation.x = -stride * 0.48;
    if (leftArm.current) leftArm.current.rotation.x = -stride * 0.5 + (ghost && idle ? Math.sin(t * 2) * 0.12 : 0);
    if (rightArm.current) rightArm.current.rotation.x = stride * 0.5 + (ghost && idle ? -Math.sin(t * 2) * 0.12 : 0);
    if (tail.current) tail.current.rotation.y = idle ? Math.sin(t * 3) * 0.17 : 0;
    if (eyes.current) eyes.current.scale.y = idle && t % 4.8 < 0.12 ? 0.12 : 1;
    if (head.current) head.current.rotation.z += ((idle ? Math.sin(t * 1.5) * 0.035 : 0) - head.current.rotation.z) * Math.min(1, dt * 10);
    const age = hitAt === undefined ? Infinity : Date.now() + (offset?.current ?? 0) - hitAt;
    if (fabric.current) fabric.current.emissiveIntensity = age >= 0 && age < 350 ? Math.sin(age / 350 * Math.PI) * 2 : ghost ? 0.22 : 0;
  });
  return <group ref={root}>
    {ghost ? <>
      <mesh position={[0, 0.72, 0]} castShadow><cylinderGeometry args={[0.35, 0.45, 0.83, 20]}/><meshStandardMaterial ref={fabric} color={skin} emissive="#9df6e9" emissiveIntensity={0.22} roughness={0.4}/></mesh>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[Math.cos(i / 7 * Math.PI * 2) * 0.31, 0.28, Math.sin(i / 7 * Math.PI * 2) * 0.31]} scale={[1, 0.75, 1]}><sphereGeometry args={[0.16, 12, 8]}/><meshStandardMaterial color={skin}/></mesh>)}
    </> : <>
      <mesh position={[0, 0.79, 0]} scale={[animal ? 1.08 : 1, 1, 0.9]} castShadow><capsuleGeometry args={[0.29, 0.48, 6, 12]}/><meshStandardMaterial ref={fabric} color={animal ? skin : color} emissive="#ff776c" roughness={0.8}/></mesh>
      {animal && <mesh position={[0, 0.73, -0.245]} scale={[0.21, 0.29, 0.05]}><sphereGeometry args={[1, 16, 12]}/><meshStandardMaterial color="#fff1da"/></mesh>}
      {!animal && <>
        <mesh position={[0, 0.76, -0.28]}><boxGeometry args={[0.025, 0.52, 0.018]}/><meshStandardMaterial color="#deeff2"/></mesh>
        <mesh position={[0, 0.86, 0.28]} castShadow><boxGeometry args={[0.42, 0.49, 0.22]}/><meshStandardMaterial color="#384b59" roughness={0.9}/></mesh>
      </>}
    </>}
    <group ref={head} position={[0, ghost ? 1.13 : 1.37, 0]}>
      <mesh scale={[animal ? 1.12 : 1, animal ? 0.94 : 1, 1]} castShadow><sphereGeometry args={[ghost ? 0.4 : 0.37, 20, 16]}/><meshStandardMaterial color={skin} roughness={0.65}/></mesh>
      <group ref={eyes}><Eyes ghost={ghost}/></group>
      {variant === "fox" && <>
        {[-1, 1].map((side) => <group key={side} position={[side * 0.26, 0.35, 0]} rotation={[0, 0, side * -0.22]}>
          <mesh castShadow><coneGeometry args={[0.18, 0.4, 4]}/><meshStandardMaterial color={skin}/></mesh>
          <mesh position={[0, 0.025, -0.073]} scale={[0.58, 0.65, 0.35]}><coneGeometry args={[0.18, 0.4, 4]}/><meshStandardMaterial color="#513f4a"/></mesh>
        </group>)}
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.16, -0.14, -0.3]} scale={[0.19, 0.13, 0.13]}><sphereGeometry args={[1, 16, 10]}/><meshStandardMaterial color="#fff1dc"/></mesh>)}
        <mesh position={[0, -0.08, -0.43]} scale={[0.065, 0.045, 0.048]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#29323d"/></mesh>
      </>}
      {variant === "bunny" && <>
        {[-1, 1].map((side) => <group key={side} position={[side * 0.18, 0.46, 0]} rotation={[0, 0, side * -0.13]}>
          <mesh scale={[0.12, 0.43, 0.09]} castShadow><sphereGeometry args={[1, 16, 12]}/><meshStandardMaterial color={skin}/></mesh>
          <mesh position={[0, 0, -0.077]} scale={[0.064, 0.31, 0.02]}><sphereGeometry args={[1, 12, 10]}/><meshStandardMaterial color="#eeb3be"/></mesh>
        </group>)}
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.1, -0.14, -0.325]} scale={[0.12, 0.1, 0.07]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#fff"/></mesh>)}
        <mesh position={[0, -0.085, -0.39]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.045, 0.055, 3]}/><meshStandardMaterial color="#d98c9e"/></mesh>
      </>}
      {variant === "human" && <>
        <mesh position={[0, 0.04, 0]} castShadow><sphereGeometry args={[0.385, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]}/><meshStandardMaterial color="#403b45"/></mesh>
        <mesh position={[-0.13, 0.21, -0.25]} rotation={[0.2, 0, -0.35]} scale={[0.24, 0.12, 0.13]}><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color="#403b45"/></mesh>
        <mesh position={[0, -0.07, -0.36]} scale={[0.045, 0.055, 0.065]}><sphereGeometry args={[1, 10, 8]}/><meshStandardMaterial color={skin}/></mesh>
        {[-1, 1].map((side) => <mesh key={side} position={[side * 0.35, 0, 0]} scale={[0.075, 0.1, 0.075]}><sphereGeometry args={[1, 10, 8]}/><meshStandardMaterial color={skin}/></mesh>)}
      </>}
    </group>
    <mesh position={[0, ghost ? 0.92 : 1.11, 0]}><torusGeometry args={[ghost ? 0.34 : 0.25, 0.065, 6, 18]}/><meshStandardMaterial color={color} roughness={0.8}/></mesh>
    <mesh position={[0.16, ghost ? 0.76 : 0.94, -0.3]} rotation={[0, 0, -0.18]}><boxGeometry args={[0.13, 0.27, 0.035]}/><meshStandardMaterial color={color}/></mesh>
    {[-1, 1].map((side) => <group key={side} ref={side < 0 ? leftArm : rightArm} position={[side * 0.35, 1.02, 0]} rotation={[0, 0, side * -0.2]}>
      <mesh position={[0, -0.19, 0]} castShadow><capsuleGeometry args={[0.105, 0.26, 4, 10]}/><meshStandardMaterial color={ghost ? skin : animal ? skin : color}/></mesh>
      {!ghost && <mesh position={[0, -0.39, -0.015]}><sphereGeometry args={[0.11, 12, 8]}/><meshStandardMaterial color={skin}/></mesh>}
    </group>)}
    {!ghost && [-1, 1].map((side) => <group key={side} ref={side < 0 ? leftFoot : rightFoot} position={[side * 0.16, 0.44, 0]}>
      <mesh position={[0, -0.16, 0]} castShadow><capsuleGeometry args={[0.105, 0.19, 4, 10]}/><meshStandardMaterial color={animal ? skin : "#344457"}/></mesh>
      <mesh position={[0, -0.34, -0.08]} scale={[0.15, 0.095, animal ? 0.24 : 0.2]} castShadow><sphereGeometry args={[1, 12, 8]}/><meshStandardMaterial color={animal ? "#efe3d1" : "#273345"}/></mesh>
    </group>)}
    {variant === "fox" && <group ref={tail} position={[0, 0.59, 0.27]} rotation={[0.9, 0, 0]}>
      <mesh position={[0, 0.27, 0]} scale={[0.21, 0.41, 0.21]} castShadow><sphereGeometry args={[1, 12, 10]}/><meshStandardMaterial color={skin}/></mesh>
      <mesh position={[0, 0.59, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.15, 0.27, 12]}/><meshStandardMaterial color="#fff0d8"/></mesh>
    </group>}
    {variant === "bunny" && <mesh position={[0, 0.54, 0.34]} castShadow><sphereGeometry args={[0.16, 12, 10]}/><meshStandardMaterial color="#fff"/></mesh>}
  </group>;
}
