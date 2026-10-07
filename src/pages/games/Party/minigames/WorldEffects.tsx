import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Points, PointLight, ShaderMaterial } from "three";

const waterVertex = `varying vec2 vUv; uniform float uTime;
void main() { vUv=uv; vec3 p=position; p.z+=sin(p.x*1.4+uTime)*cos(p.y*1.1+uTime*.7)*.045;
gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`;
const waterFragment = `varying vec2 vUv; uniform float uTime; uniform float uLava;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 p=vUv*28.;float n=noise(p+uTime*.14)*.65+noise(p*2.-uTime*.2)*.35;
float wave=sin(p.x*1.7+uTime*.65+n*3.)*cos(p.y*1.9-uTime*.4);
vec3 water=mix(vec3(.018,.09,.19),vec3(.055,.32,.46),n);
water+=vec3(.12,.3,.33)*pow(max(0.,wave),10.)*.55;
float cracks=smoothstep(.48,.59,n);vec3 lava=mix(vec3(.18,.022,.055),vec3(1.,.21,.025),cracks);
lava=mix(lava,vec3(1.,.68,.13),pow(cracks,4.)*(.65+.2*sin(uTime+p.x)));
gl_FragColor=vec4(mix(water,lava,uLava),1.); }`;

export function LivingSurface({ lava, motion }: { lava: boolean; motion: boolean }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uLava: { value: lava ? 1 : 0 } }), [lava]);
  useFrame(({ clock }) => { if (material.current) material.current.uniforms.uTime.value = motion ? clock.elapsedTime : 0; });
  return <mesh position={[0, -1.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[32, 32, 64, 64]}/>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={waterVertex} fragmentShader={waterFragment}/>
  </mesh>;
}

export function AtmosphereParticles({ kind, motion, area = 17 }: { kind: "snow" | "embers" | "dust"; motion: boolean; area?: number }) {
  const points = useRef<Points>(null), count = kind === "dust" ? 60 : 160;
  const positions = useMemo(() => {
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      data[i * 3] = ((i * 0.6180339) % 1 - 0.5) * area;
      data[i * 3 + 1] = (i * 0.4142135) % 1 * 8;
      data[i * 3 + 2] = ((i * 0.7548776) % 1 - 0.5) * area;
    }
    return data;
  }, [count, area]);
  const initialPositions = useMemo(() => positions.slice(), [positions]);
  useFrame(({ clock }) => {
    if (!points.current || !motion) return;
    const attribute = points.current.geometry.attributes.position, data = attribute.array;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      data[i * 3] = positions[i * 3] + Math.sin(t * 0.5 + i) * 0.3;
      const height = (i * 0.4142135) % 1 * 8 + t * (kind === "snow" ? -0.45 : 0.4 + i % 3 * 0.1);
      data[i * 3 + 1] = ((height % 8) + 8) % 8 - 0.6;
    }
    attribute.needsUpdate = true;
  });
  return <points ref={points} frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[initialPositions, 3]}/></bufferGeometry>
    <pointsMaterial size={kind === "embers" ? 0.055 : 0.04} color={kind === "snow" ? "#d7f5ff" : kind === "dust" ? "#c9aaff" : "#ffbc56"} transparent opacity={0.75} depthWrite={false} sizeAttenuation/>
  </points>;
}

export function Flame({ motion, scale = 1 }: { motion: boolean; scale?: number }) {
  const flame = useRef<Group>(null), light = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const flicker = motion ? Math.sin(clock.elapsedTime * 11) * 0.12 + Math.sin(clock.elapsedTime * 17) * 0.07 : 0;
    if (flame.current) { flame.current.scale.y = 1 + flicker; flame.current.rotation.z = flicker * 0.2; }
    if (light.current) light.current.intensity = (1.6 + flicker) * scale;
  });
  return <group scale={scale}>
    <group ref={flame}>
      <mesh position={[0, 0.23, 0]}><coneGeometry args={[0.18, 0.58, 7]}/><meshBasicMaterial color="#ff7935"/></mesh>
      <mesh position={[0, 0.16, 0.015]}><coneGeometry args={[0.1, 0.37, 7]}/><meshBasicMaterial color="#ffe8a0"/></mesh>
    </group>
    <pointLight ref={light} position={[0, 0.4, 0]} color="#ff9248" intensity={1.6} distance={6} decay={2}/>
  </group>;
}
