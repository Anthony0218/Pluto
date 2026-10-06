import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Sky } from "@react-three/drei";
import { CanvasTexture, Color, Group, InstancedMesh, Object3D, ShaderMaterial, SRGBColorSpace } from "three";
import { floorPieces, type ArenaMap, type ArenaBox } from "../../../../games/party/minigames/pickupArena/maps.ts";
import { AtmosphereParticles } from "./WorldEffects.tsx";
import { useSceneMotion } from "./useSceneMotion.ts";

function SceneSign({ text, subtext, color, width, height }: { text: string; subtext: string; color: string; width: number; height: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#122339"; ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 752, 176);
    ctx.fillStyle = color; ctx.font = "bold 57px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(text, 384, 93, 714);
    ctx.fillStyle = "#e4eef3"; ctx.font = "24px sans-serif"; ctx.fillText(subtext, 384, 143, 714);
    const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace; return result;
  }, [text, subtext, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh><planeGeometry args={[width, height]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>;
}

const screenVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const screenFragment = `varying vec2 vUv; uniform float uTime; uniform float uSeed;
void main(){vec2 p=floor(vUv*vec2(22.,17.));float scan=.8+.2*sin(vUv.y*220.);
float orb=step(length(p-vec2(11.+sin(uTime*.8+uSeed)*6.,8.+cos(uTime+uSeed)*4.)),3.);
float star=step(.975,fract(sin(dot(p,vec2(12.9,78.2))+uSeed)*43758.));
vec3 base=mix(vec3(.04,.12,.25),vec3(.09,.025,.24),vUv.y);
vec3 glow=mix(vec3(.17,.95,.82),vec3(1.,.38,.65),.5+.5*sin(uSeed));
gl_FragColor=vec4((base+orb*glow+star*.65)*scan,1.);}`;

function ArcadeDisplay({ seed, motion, width, height }: { seed: number; motion: boolean; width: number; height: number }) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSeed: { value: seed } }), [seed]);
  useFrame(({ clock }) => { if (material.current) material.current.uniforms.uTime.value = motion ? clock.elapsedTime : 0; });
  return <mesh><planeGeometry args={[width, height]}/><shaderMaterial ref={material} uniforms={uniforms} vertexShader={screenVertex} fragmentShader={screenFragment} toneMapped={false}/></mesh>;
}

function ArcadeCabinet({ box, motion }: { box: ArenaBox; motion: boolean }) {
  const accent = box.y < 4 ? "#54eadc" : box.y < 8 ? "#f68ace" : "#fac77c";
  return <group position={[box.x, box.y, box.z]}>
    <RoundedBox args={[box.w, box.h, box.d]} radius={0.08} smoothness={2} castShadow receiveShadow><meshStandardMaterial color={box.color} roughness={0.48} metalness={0.2}/></RoundedBox>
    <mesh position={[0, 0.18, box.d / 2 + 0.017]}><boxGeometry args={[box.w * 0.8, box.h * 0.5, 0.06]}/><meshStandardMaterial color="#142033" roughness={0.45}/></mesh>
    <group position={[0, 0.21, box.d / 2 + 0.06]}><ArcadeDisplay seed={box.x + box.z} motion={motion} width={box.w * 0.69} height={box.h * 0.39}/></group>
    <mesh position={[0, -0.47, box.d / 2 + 0.12]} rotation={[-0.25, 0, 0]} castShadow><boxGeometry args={[box.w * 0.94, 0.17, 0.48]}/><meshStandardMaterial color="#243042" metalness={0.35}/></mesh>
    <mesh position={[-0.42, -0.31, box.d / 2 + 0.18]}><cylinderGeometry args={[0.025, 0.025, 0.2, 8]}/><meshStandardMaterial color="#d0ddde" metalness={0.7}/></mesh>
    <mesh position={[-0.42, -0.19, box.d / 2 + 0.18]}><sphereGeometry args={[0.075, 12, 8]}/><meshStandardMaterial color="#fa668e" roughness={0.25}/></mesh>
    {[0, 1, 2].map((i) => <mesh key={i} position={[0.22 + i * 0.18, -0.35, box.d / 2 + 0.17]}><cylinderGeometry args={[0.058, 0.065, 0.06, 10]}/><meshStandardMaterial color={["#fc8c88", "#e8cb79", "#6cdccd"][i]} emissive={accent} emissiveIntensity={0.2}/></mesh>)}
    <group position={[0, box.h / 2 - 0.17, box.d / 2 + 0.03]}><SceneSign text="STAR QUEST" subtext="PRESS START" color={accent} width={box.w * 0.86} height={0.3}/></group>
    {[-1, 1].map((side) => <mesh key={side} position={[side * (box.w / 2 - 0.065), 0, box.d / 2 + 0.015]}><boxGeometry args={[0.04, box.h * 0.87, 0.025]}/><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2}/></mesh>)}
    <mesh position={[0, -0.77, box.d / 2 + 0.02]}><boxGeometry args={[0.2, 0.075, 0.03]}/><meshStandardMaterial color="#0b1523"/></mesh>
  </group>;
}

function AirHockeyTable({ box, motion }: { box: ArenaBox; motion: boolean }) {
  const puck = useRef<Group>(null);
  useFrame(({ clock }) => { if (puck.current) puck.current.position.x = motion ? Math.sin(clock.elapsedTime * 1.7 + box.x) * 0.8 : 0; });
  return <group position={[box.x, box.y, box.z]}>
    <RoundedBox args={[box.w, box.h, box.d]} radius={0.1} smoothness={2} castShadow receiveShadow><meshStandardMaterial color="#273b58" roughness={0.7}/></RoundedBox>
    <mesh position={[0, box.h / 2 + 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[box.w - 0.15, box.d - 0.15]}/><meshStandardMaterial color="#89c9cd" roughness={0.35}/></mesh>
    <mesh position={[0, box.h / 2 + 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.36, 0.39, 32]}/><meshBasicMaterial color="#edfaf7"/></mesh>
    <mesh position={[0, box.h / 2 + 0.029, 0]}><boxGeometry args={[0.025, 0.008, box.d - 0.2]}/><meshBasicMaterial color="#fff"/></mesh>
    <group ref={puck} position={[0, box.h / 2 + 0.07, 0.3]}><mesh><cylinderGeometry args={[0.1, 0.1, 0.08, 12]}/><meshStandardMaterial color="#fa6b8c"/></mesh></group>
    {[-1, 1].map((side) => <mesh key={side} position={[side * (box.w / 2 - 0.1), box.h / 2, 0]}><boxGeometry args={[0.045, 0.04, box.d]}/><meshStandardMaterial color="#63ffdc" emissive="#40d4bd" emissiveIntensity={2}/></mesh>)}
  </group>;
}

function BuildingWindows({ depth, index }: { depth: number; index: number }) {
  const frames = useRef<InstancedMesh>(null), glass = useRef<InstancedMesh>(null), ledges = useRef<InstancedMesh>(null);
  useEffect(() => {
    const object = new Object3D(); let i = 0;
    for (let face = 0; face < 4; face++) for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
      const angle = face * Math.PI / 2, x = (col - 1) * 2.7, y = [3.9, 6.5, 8.9][row];
      const set = (target: InstancedMesh | null, outward: number, vertical = 0) => {
        object.position.set(Math.cos(angle) * x + Math.sin(angle) * outward, y + vertical, -Math.sin(angle) * x + Math.cos(angle) * outward);
        object.rotation.set(0, angle, 0); object.updateMatrix(); target?.setMatrixAt(i, object.matrix);
      };
      set(frames.current, depth + .02); set(glass.current, depth + .085); set(ledges.current, depth + .08, -.9);
      glass.current?.setColorAt(i, new Color((row + col + face + index) % 4 === 0 ? "#efd7a5" : "#83a9bb")); i++;
    }
    for (const mesh of [frames.current, glass.current, ledges.current]) if (mesh) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); }
  }, [depth, index]);
  return <><instancedMesh ref={frames} args={[undefined, undefined, 36]}><boxGeometry args={[1.45, 1.75, .1]}/><meshStandardMaterial color="#dae1dc" roughness={.8}/></instancedMesh>
    <instancedMesh ref={glass} args={[undefined, undefined, 36]}><planeGeometry args={[1.2, 1.5]}/><meshStandardMaterial metalness={.4} roughness={.25} emissive="#284257" emissiveIntensity={.3}/></instancedMesh>
    <instancedMesh ref={ledges} args={[undefined, undefined, 36]}><boxGeometry args={[1.6, .08, .25]}/><meshStandardMaterial color="#a8b7bd"/></instancedMesh></>;
}
function Building({ box, index, motion }: { box: ArenaBox; index: number; motion: boolean }) {
  const signColors = ["#f7b89b", "#83d7d2", "#c2b0ef", "#f1d68d"], accent = signColors[index % 4];
  const fan = useRef<Group>(null), flag = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (fan.current) fan.current.rotation.y = motion ? clock.elapsedTime * 2 : 0;
    if (flag.current) { flag.current.rotation.y = motion ? Math.sin(clock.elapsedTime * 2 + index) * 0.12 : 0; flag.current.rotation.z = motion ? Math.sin(clock.elapsedTime * 3 + index) * 0.04 : 0; }
  });
  return <group position={[box.x, 0, box.z]}>
    <mesh position={[0, box.y, 0]} castShadow receiveShadow><boxGeometry args={[box.w, box.h, box.d]}/><meshStandardMaterial color={box.color} roughness={0.87}/></mesh>
    <mesh position={[0, box.h + 0.1, 0]} castShadow><boxGeometry args={[box.w + 0.15, 0.28, box.d + 0.15]}/><meshStandardMaterial color="#374754" roughness={0.9}/></mesh>
    {[2.9, 5.4, 8].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[box.w + 0.05, 0.09, box.d + 0.05]}/><meshStandardMaterial color="#c1b9ad"/></mesh>)}
    <BuildingWindows depth={box.d / 2} index={index}/>
    {[0, 1, 2, 3].map((face) => <group key={face} rotation={[0, face * Math.PI / 2, 0]}>
      <group position={[0, 2.2, box.d / 2 + 0.075]}><SceneSign text={["MOONBEAN", "PLUTO MART", "RECORD ROOM", "STAR NOODLES"][index % 4]} subtext={["COFFEE & COMETS", "OPEN ALL NIGHT", "GOOD VIBRATIONS", "HOT BOWLS · COOL PEOPLE"][index % 4]} color={accent} width={5.8} height={1.2}/></group>
      <mesh position={[0, 1.05, box.d / 2 + 0.04]}><boxGeometry args={[1.2, 1.9, 0.08]}/><meshStandardMaterial color="#38596c" metalness={0.35} roughness={0.2}/></mesh>
      <mesh position={[0.36, 1, box.d / 2 + 0.1]}><boxGeometry args={[0.025, 0.25, 0.03]}/><meshStandardMaterial color="#ecd29e" metalness={0.8}/></mesh>
    </group>)}
    <mesh position={[2.3, box.h + 0.5, 1.7]}><boxGeometry args={[1.7, 0.75, 1.3]}/><meshStandardMaterial color="#9aabb1" roughness={0.8}/></mesh>
    <group ref={fan} position={[2.3, box.h + 0.9, 1.7]}>
      {[0, 1, 2, 3].map((i) => <mesh key={i} rotation={[0, i * Math.PI / 2, 0]}><boxGeometry args={[1.1, 0.04, 0.12]}/><meshStandardMaterial color="#3a5261" metalness={0.5}/></mesh>)}
    </group>
    <mesh position={[0, box.h + 1, box.d / 2 - 0.4]}><cylinderGeometry args={[0.025, 0.025, 2, 8]}/><meshStandardMaterial color="#b6bfc2" metalness={0.6}/></mesh>
    <group ref={flag} position={[0, box.h + 1.7, box.d / 2 - 0.4]}>
      <mesh position={[0.5, 0, 0]}><planeGeometry args={[1, 0.42]}/><meshStandardMaterial color={accent} side={2} roughness={0.8}/></mesh>
    </group>
    <mesh position={[-2.5, box.h + 0.8, -1.8]}><cylinderGeometry args={[0.7, 0.7, 1.4, 12]}/><meshStandardMaterial color="#759192" roughness={0.8}/></mesh>
    <mesh position={[-2.5, box.h + 1.58, -1.8]}><coneGeometry args={[0.85, 0.4, 12]}/><meshStandardMaterial color="#4f686d"/></mesh>
  </group>;
}

function Car({ box }: { box: ArenaBox }) {
  return <group position={[box.x, 0, box.z]}>
    <RoundedBox args={[box.w, 0.7, box.d]} position={[0, 0.75, 0]} radius={0.18} smoothness={3} castShadow><meshStandardMaterial color={box.color} metalness={0.3} roughness={0.24}/></RoundedBox>
    <RoundedBox args={[box.w * 0.48, 0.55, box.d * 0.83]} position={[0, 1.3, 0]} radius={0.12} smoothness={2} castShadow><meshStandardMaterial color="#2a465e" metalness={0.45} roughness={0.22}/></RoundedBox>
    <mesh position={[0, 1.61, 0]}><boxGeometry args={[box.w * 0.47, 0.07, box.d * 0.83]}/><meshStandardMaterial color={box.color} metalness={0.3} roughness={0.25}/></mesh>
    {[-1, 1].flatMap((side) => [-1, 1].map((end) => <group key={`${side}:${end}`} position={[end * box.w * 0.32, 0.4, side * box.d / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow><cylinderGeometry args={[0.32, 0.32, 0.16, 16]}/><meshStandardMaterial color="#25313d" roughness={0.95}/></mesh>
      <mesh><cylinderGeometry args={[0.16, 0.16, 0.18, 12]}/><meshStandardMaterial color="#afbfcb" metalness={0.75} roughness={0.35}/></mesh>
    </group>))}
    {[-1, 1].flatMap((end) => [-1, 1].map((side) => <mesh key={`${side}:${end}`} position={[end * (box.w / 2 + 0.01), 0.9, side * box.d * 0.31]}><boxGeometry args={[0.02, 0.16, 0.32]}/><meshStandardMaterial color={end > 0 ? "#fae4b9" : "#eb6474"} emissive={end > 0 ? "#ecd797" : "#983648"} emissiveIntensity={0.6}/></mesh>))}
  </group>;
}

function CityCover({ box }: { box: ArenaBox }) {
  if (box.w > 3) return <Car box={box}/>;
  return <group position={[box.x, box.y, box.z]}>
    <RoundedBox args={[box.w, box.h, box.d]} radius={0.055} smoothness={2} castShadow receiveShadow><meshStandardMaterial color={box.color} roughness={0.85}/></RoundedBox>
    {[-1, 1].map((side) => <mesh key={side} position={[side * box.w * 0.35, 0, 0]}><boxGeometry args={[0.06, box.h + 0.025, box.d + 0.025]}/><meshStandardMaterial color="#394c4d" metalness={0.3}/></mesh>)}
    <mesh position={[0, 0, box.d / 2 + 0.02]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.16, 0.16, 0.025]}/><meshStandardMaterial color="#f4d88c"/></mesh>
  </group>;
}

export const ArenaWorld = memo(function ArenaWorld({ map }: { map: ArenaMap }) {
  const motion = useSceneMotion(), arcade = map.id === "arcade";
  return <>
    <color attach="background" args={[arcade ? "#14152c" : "#c0c9d2"]}/>
    <fog attach="fog" args={[arcade ? "#171a32" : "#bbc8d2", arcade ? 25 : 42, 85]}/>
    <hemisphereLight args={[arcade ? "#c7b6ec" : "#fff0d9", arcade ? "#25496a" : "#657b94", arcade ? 1.25 : 1.8]}/>
    {arcade && <ambientLight color="#c5c1e8" intensity={0.65}/>}
    <directionalLight position={[-10, 20, 8]} intensity={arcade ? 1.8 : 2.5} color={arcade ? "#cad9ff" : "#fff1ce"}/>
    {!arcade && <Sky sunPosition={[-35, 18, -40]} turbidity={5} rayleigh={0.8}/>}
    {Array.from({ length: map.floors }, (_, floor) => floorPieces(map, floor).map((p, i) => <mesh key={`${floor}:${i}`} position={[p.x, floor * 4 - 0.12, p.z]} receiveShadow>
      <boxGeometry args={[p.w, 0.24, p.d]}/><meshStandardMaterial color={arcade ? ["#29304d", "#382c4f", "#24464d"][floor] : "#56616b"} roughness={0.85}/>
    </mesh>))}
    {map.boxes.map((box, i) => box.kind === "cabinet" ? <ArcadeCabinet key={i} box={box} motion={motion}/> : box.kind === "building" ? <Building key={i} box={box} index={i - 4} motion={motion}/> : box.kind === "cover" ? arcade ? <AirHockeyTable key={i} box={box} motion={motion}/> : <CityCover key={i} box={box}/> : <mesh key={i} position={[box.x, box.y, box.z]} receiveShadow><boxGeometry args={[box.w, box.h, box.d]}/><meshStandardMaterial color={arcade ? "#21253e" : "#94a7b5"} roughness={0.8}/></mesh>)}
    {map.stairs.map((stair, i) => <group key={i}>
      {Array.from({ length: 16 }, (_, step) => <group key={step} position={[stair.x, stair.base + (step + 0.5) * stair.rise / 16 - 0.12, stair.z - stair.length / 2 + (step + 0.5) * stair.length / 16]}>
        <mesh><boxGeometry args={[stair.w, 0.24, stair.length / 16]}/><meshStandardMaterial color="#6a7596" roughness={0.7}/></mesh>
        <mesh position={[0, 0.125, -stair.length / 32 + 0.01]}><boxGeometry args={[stair.w, 0.025, 0.045]}/><meshStandardMaterial color="#91f0d9" emissive="#3bb9ae" emissiveIntensity={1.5}/></mesh>
      </group>)}
      <group position={[stair.x, stair.base + 1.8, stair.z - stair.length / 2 - 0.65]} rotation={[0, Math.PI, 0]}><SceneSign text={`LEVEL ${stair.base / 4 + 2} ↑`} subtext="TAKE THE STAIRS" color="#a2f4da" width={stair.w} height={0.55}/></group>
      <mesh position={[stair.x, stair.base + 0.03, stair.z - stair.length / 2 - 0.7]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[stair.w, 1]}/><meshStandardMaterial color="#73d3b7" emissive="#22a878" emissiveIntensity={0.3}/></mesh>
    </group>)}
    {arcade ? [0, 4, 8].map((y, floor) => <group key={y}>
      {floor < 2 && floorPieces(map, floor + 1).map((p, i) => <mesh key={`ceiling:${i}`} position={[p.x, y + 3.745, p.z]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[p.w, p.d]}/><meshStandardMaterial color="#343549" emissive="#1c2237" emissiveIntensity={0.5} roughness={0.9}/></mesh>)}
      {[-6, 6].flatMap((x) => [-9, 0, 9].map((z) => <mesh key={`light:${x}:${z}`} position={[x, y + 3.72, z]}><boxGeometry args={[1.2, 0.035, 0.55]}/><meshStandardMaterial color="#b4edff" emissive="#8ec1dc" emissiveIntensity={1.8}/></mesh>))}
      {[-1, 1].map((side) => <group key={side}>
        <mesh position={[0, y + 3.5, side * 15.65]}><boxGeometry args={[30, 0.08, 0.08]}/><meshStandardMaterial color={side < 0 ? "#fa83da" : "#78ecec"} emissive={side < 0 ? "#ed4da5" : "#39b8c7"} emissiveIntensity={2.3}/></mesh>
        <mesh position={[side * 15.6, y + 0.15, 0]}><boxGeometry args={[0.06, 0.09, 31]}/><meshStandardMaterial color="#9e85ea" emissive="#6d55d1" emissiveIntensity={2}/></mesh>
      </group>)}
      <group position={[0, y + 2.65, -15.7]}><SceneSign text="NEON PLAY ARCADE" subtext={`LEVEL 0${floor + 1} · FIND YOUR NEXT HIGH SCORE`} color={["#8af3e3", "#ffa2da", "#fed995"][floor]} width={7} height={1.3}/></group>
      {[-10, 10].map((x) => <mesh key={x} position={[x, y + 3.72, 0]}><boxGeometry args={[0.3, 0.04, 20]}/><meshStandardMaterial color="#d3bcf4" emissive="#aa88cf" emissiveIntensity={1.5}/></mesh>)}
      <mesh position={[0, y + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.65, 2.7, 6]}/><meshBasicMaterial color="#689baf" transparent opacity={0.6}/></mesh>
    </group>) : <>
      {[-1, 1].map((side) => <group key={side}>
        <mesh position={[side * 3, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.09, 43]}/><meshStandardMaterial color="#ead59b"/></mesh>
        <mesh position={[side * 5.8, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.14, 43]}/><meshStandardMaterial color="#bac9c7"/></mesh>
        {[-4, 4].flatMap((z) => [-2.3, -1.15, 0, 1.15, 2.3].map((x) => <mesh key={`${z}:${x}`} position={[x, 0.021, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.6, 1.4]}/><meshStandardMaterial color="#d4dfdb" roughness={0.9}/></mesh>))}
        <mesh position={[side * 8.3, 2, 0.5]}><cylinderGeometry args={[0.055, 0.08, 4, 10]}/><meshStandardMaterial color="#3c4e61" metalness={0.45}/></mesh>
        <mesh position={[side * 7.9, 4.1, 0.5]}><boxGeometry args={[0.9, 0.12, 0.25]}/><meshStandardMaterial color="#c5d6df" emissive="#b8aa7c" emissiveIntensity={0.5}/></mesh>
        {[-1, 1].map((zSide) => <group key={zSide} position={[side * 27, 0, zSide * 21]}>
          <mesh position={[0, 6, 0]}><boxGeometry args={[7, 12, 8]}/><meshStandardMaterial color="#8093a9"/></mesh>
          <mesh position={[8 * side, 9, 0]}><boxGeometry args={[6, 18, 7]}/><meshStandardMaterial color="#94a2b4"/></mesh>
        </group>)}
      </group>)}
    </>}
    {arcade && <AtmosphereParticles kind="dust" motion={motion} area={29}/>}
  </>;
});
