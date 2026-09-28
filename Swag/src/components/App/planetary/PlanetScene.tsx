import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { planets, type PlanetConfig } from "./planetConfig";

function Orbit({ radius }: { radius: number }) {
  const points = useMemo(() => Array.from({ length: 97 }, (_, index) => {
    const angle = index / 96 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.54, 0);
  }), [radius]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return <lineLoop geometry={geometry}><lineBasicMaterial color="#5e739c" transparent opacity={0.2} /></lineLoop>;
}
function Planet({ config, reducedMotion }: { config: PlanetConfig; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const angle = useRef(config.startAngle);
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();
  const symbolTexture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) { context.textAlign = "center"; context.textBaseline = "middle"; context.font = "bold 88px Georgia, serif"; context.fillStyle = "rgba(19,29,53,.62)"; context.fillText(config.symbol, 65, 70); context.fillStyle = "rgba(255,255,255,.28)"; context.fillText(config.symbol, 62, 67); }
    return new THREE.CanvasTexture(canvas);
  }, [config.symbol]);
  useEffect(() => () => symbolTexture.dispose(), [symbolTexture]);
  useFrame((_, delta) => {
    if (document.hidden || !group.current || !mesh.current) return;
    if (!reducedMotion) angle.current += Math.min(delta, 0.05) * config.orbitSpeed * (hovered ? 1.3 : 1);
    group.current.position.set(Math.cos(angle.current) * config.orbitRadius, Math.sin(angle.current) * config.orbitRadius * 0.54, 0);
    if (!reducedMotion) mesh.current.rotation.y += Math.min(delta, 0.05) * config.rotationSpeed * (hovered ? 3 : 1);
    const target = hovered ? 1.13 : 1;
    mesh.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
  });
  return <group ref={group} position={[Math.cos(config.startAngle) * config.orbitRadius, Math.sin(config.startAngle) * config.orbitRadius * 0.54, 0]}>
    <mesh ref={mesh} onClick={() => navigate(config.route)} onPointerOver={event => { event.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = ""; }}>
      <sphereGeometry args={[config.radius, 32, 24]} />
      <meshStandardMaterial color={config.color} emissive={config.emissive} emissiveIntensity={hovered ? 0.65 : 0.34} metalness={0.3} roughness={0.48} />
      <mesh position={[0, 0, config.radius * 1.008]}><planeGeometry args={[config.radius * 1.25, config.radius * 1.25]} /><meshBasicMaterial map={symbolTexture} transparent depthWrite={false} /></mesh>
    </mesh>
    <mesh raycast={() => []} scale={hovered ? 1.35 : 1.16}><sphereGeometry args={[config.radius, 24, 16]} /><meshBasicMaterial color={config.color} transparent opacity={hovered ? 0.17 : 0.08} depthWrite={false} /></mesh>
  </group>;
}
export default function PlanetScene({ reducedMotion }: { reducedMotion: boolean }) {
  return <Canvas aria-hidden="true" dpr={[1, 1.5]} frameloop={reducedMotion ? "demand" : "always"} camera={{ position: [0, 0, 10], fov: 45 }} gl={{ antialias: false, powerPreference: "low-power" }}>
    <color attach="background" args={["#0c1325"]} />
    <ambientLight intensity={1.1} />
    <pointLight position={[0, 0, 2]} intensity={24} color="#b7c7ff" distance={10} />
    <mesh><sphereGeometry args={[1.08, 32, 24]} /><meshStandardMaterial color="#283764" emissive="#354cb4" emissiveIntensity={0.7} metalness={0.55} roughness={0.35} /></mesh>
    {planets.map(planet => <Orbit key={`orbit-${planet.id}`} radius={planet.orbitRadius} />)}
    {planets.map(planet => <Planet key={planet.id} config={planet} reducedMotion={reducedMotion} />)}
  </Canvas>;
}
