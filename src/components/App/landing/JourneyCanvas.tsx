import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { planetArtSize, type PlanetPose } from "./planetPose";

// ── Procedural textures and shaders (no assets to download) ──

/** Soft horizontal cloud bands, grey so the tone colour tints them. */
function bandTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 512;
  const context = canvas.getContext("2d")!;
  for (let y = 0; y < canvas.height; y++) {
    const v = y / canvas.height;
    const wave = 0.84 + 0.12 * Math.sin(v * 38) + 0.06 * Math.sin(v * 91 + 1.7) + 0.035 * Math.sin(v * 173);
    context.fillStyle = `rgb(${Math.round(wave * 255)},${Math.round(wave * 255)},${Math.round(wave * 255)})`;
    context.fillRect(0, y, canvas.width, 1);
  }
  // Streaks of turbulence along the bands.
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * canvas.height, x = Math.random() * canvas.width, length = 40 + Math.random() * 220;
    context.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${0.025 + Math.random() * 0.05})`;
    context.fillRect(x, y, length, 1 + Math.random() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

const nebulaFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uSize;
  uniform vec3 uTint;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uSize.x / uSize.y, 1.0) * 2.4;
    float t = uTime * 0.018;
    float cloud = fbm(p + vec2(t, -t * 0.7) + fbm(p * 1.4 - t));
    vec3 color = vec3(0.020, 0.027, 0.075);
    color += uTint * pow(cloud, 2.3) * 0.30;
    color += vec3(0.07, 0.035, 0.13) * fbm(p * 0.8 + 3.0) * 0.55;
    vec2 cell = floor(vUv * uSize / 2.0);
    float star = step(0.9972, hash(cell));
    color += star * (0.45 + 0.55 * sin(uTime * 1.3 + hash(cell + 7.0) * 40.0)) * 0.9;
    gl_FragColor = vec4(color, 1.0);
  }
`;
const quadVertex = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const atmosphereShader = {
  vertex: /* glsl */ `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  // Back faces only: -normal.z is 0 at the outer silhouette and about 0.5 where the planet's edge sits, so the glow hugs the planet and fades outward.
  fragment: /* glsl */ `varying vec3 vNormal; uniform vec3 uColor; uniform float uOpacity; void main() { float k = clamp(-vNormal.z, 0.0, 1.0); float glow = pow(clamp(k * 2.0, 0.0, 1.0), 2.2); gl_FragColor = vec4(uColor, 1.0) * glow * uOpacity * 0.5; }`,
};
const ringShader = {
  vertex: quadVertex,
  fragment: /* glsl */ `
    varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity;
    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float band = 0.5 + 0.5 * (0.6 * sin(r * 46.0) + 0.4 * sin(r * 15.0 + 1.3));
      float gap = smoothstep(0.78, 0.79, r) * (1.0 - smoothstep(0.81, 0.82, r));
      float edge = smoothstep(0.0, 0.04, r - 0.62) * (1.0 - smoothstep(0.92, 1.0, r));
      gl_FragColor = vec4(uColor * (0.7 + 0.45 * band), edge * (0.4 + 0.4 * band) * (1.0 - 0.85 * gap) * uOpacity);
    }
  `,
};

const RESTING_LIGHT = new THREE.Vector2(-0.6, 0.8); // up and to the left, like the CSS planets

function Scene({ pose, onReady }: { pose: PlanetPose; onReady: () => void }) {
  const { size } = useThree();
  const planet = useRef<THREE.Group>(null);
  const sphere = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const nebula = useRef<THREE.ShaderMaterial>(null);
  const atmosphere = useRef<THREE.ShaderMaterial>(null);
  const ringMaterial = useRef<THREE.ShaderMaterial>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const aim = useRef(RESTING_LIGHT.clone());
  const ready = useRef(false);
  const colors = useMemo(() => ({ base: new THREE.Color(), dark: new THREE.Color(), glow: new THREE.Color(), ring: new THREE.Color(), light: new THREE.Color() }), []);
  const texture = useMemo(() => bandTexture(), []);
  const uniforms = useMemo(() => ({
    nebula: { uTime: { value: 0 }, uSize: { value: new THREE.Vector2(1, 1) }, uTint: { value: new THREE.Color() } },
    atmosphere: { uColor: { value: new THREE.Color() }, uOpacity: { value: 1 } },
    ring: { uColor: { value: new THREE.Color() }, uOpacity: { value: 1 } },
  }), []);

  useEffect(() => {
    const move = (event: PointerEvent) => { if (event.pointerType !== "touch") pointer.current = { x: event.clientX, y: event.clientY }; };
    const leave = () => { pointer.current = null; };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => { window.removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", leave); texture.dispose(); };
  }, [texture]);

  useFrame((state, delta) => {
    const x = pose.x.get(), y = -pose.y.get();
    const opacity = pose.opacity.get();
    const radius = Math.max(0.001, (planetArtSize(size.height) / 2) * pose.scale.get());
    colors.base.set(pose.base.get()); colors.dark.set(pose.dark.get()); colors.glow.set(pose.glow.get()); colors.ring.set(pose.ring.get()); colors.light.set(pose.light.get());

    // Background nebula, tinted by the current section's colour.
    // `data-still` on <html> freezes the clock and the spin so screenshot tests are repeatable (see scripts/landing/capture.mjs).
    const still = "still" in document.documentElement.dataset;
    if (nebula.current) {
      nebula.current.uniforms.uTime.value = still ? 0 : state.clock.elapsedTime;
      (nebula.current.uniforms.uSize.value as THREE.Vector2).set(size.width, size.height);
      (nebula.current.uniforms.uTint.value as THREE.Color).copy(colors.glow);
    }

    const group = planet.current, body = sphere.current;
    if (!group || !body) return;
    group.position.set(x, y, 0);
    group.scale.setScalar(radius);
    group.visible = opacity > 0.01;
    if (!still) body.rotation.y += delta * 0.04;
    const material = body.material as THREE.MeshStandardMaterial;
    material.color.copy(colors.base).lerp(colors.light, 0.22);
    material.emissive.copy(colors.dark).multiplyScalar(0.45);
    material.opacity = opacity;

    // Light the planet from the cursor, easing toward it, resting at the upper left.
    const canvas = state.gl.domElement.getBoundingClientRect();
    const wanted = pointer.current
      ? new THREE.Vector2(pointer.current.x - (canvas.left + canvas.width / 2 + x), -(pointer.current.y - (canvas.top + canvas.height / 2 - y)))
      : RESTING_LIGHT.clone();
    if (wanted.lengthSq() > 1) wanted.normalize();
    aim.current.lerp(wanted, 1 - Math.exp(-delta * 7));
    sun.current?.position.set(aim.current.x * 4, aim.current.y * 4, 3.2);

    if (atmosphere.current) { atmosphere.current.uniforms.uColor.value.copy(colors.glow); atmosphere.current.uniforms.uOpacity.value = opacity; }
    if (ringMaterial.current) { ringMaterial.current.uniforms.uColor.value.copy(colors.ring); ringMaterial.current.uniforms.uOpacity.value = opacity; }
    if (ring.current) ring.current.rotation.z = THREE.MathUtils.degToRad(pose.tilt.get());

    if (!ready.current) { ready.current = true; onReady(); }
  });

  return <>
    <mesh position={[0, 0, -500]} scale={[size.width, size.height, 1]} renderOrder={-10}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={nebula} uniforms={uniforms.nebula} vertexShader={quadVertex} fragmentShader={nebulaFragment} depthWrite={false} depthTest={false} />
    </mesh>
    <ambientLight intensity={1.1} color="#9aa6ff" />
    <directionalLight ref={sun} intensity={7.5} color="#ffffff" position={[-2.4, 3.2, 3.2]} />
    <group ref={planet}>
      <mesh ref={sphere}>
        <sphereGeometry args={[1, 96, 64]} />
        <meshStandardMaterial map={texture} roughness={0.62} metalness={0} transparent />
      </mesh>
      <mesh scale={1.16} renderOrder={1}>
        <sphereGeometry args={[1, 48, 32]} />
        <shaderMaterial ref={atmosphere} uniforms={uniforms.atmosphere} vertexShader={atmosphereShader.vertex} fragmentShader={atmosphereShader.fragment} side={THREE.BackSide} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group ref={ring} renderOrder={2}>
        <mesh rotation={[1.22, 0, 0]} scale={1.9}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial ref={ringMaterial} uniforms={uniforms.ring} vertexShader={ringShader.vertex} fragmentShader={ringShader.fragment} side={THREE.DoubleSide} transparent depthWrite={false} />
        </mesh>
      </group>
    </group>
  </>;
}

/** The travelling planet and the nebula behind it, drawn in WebGL. Mounted lazily; the CSS version is the fallback. */
export default function JourneyCanvas({ pose, active, onReady }: { pose: PlanetPose; active: boolean; onReady: () => void }) {
  return <Canvas className="journey-canvas" orthographic flat dpr={[1, 1.5]} frameloop={active ? "always" : "never"}
    gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }} camera={{ position: [0, 0, 600], zoom: 1, near: 1, far: 2000 }}>
    <Scene pose={pose} onReady={onReady} />
  </Canvas>;
}
