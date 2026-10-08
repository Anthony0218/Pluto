import { createContext, memo, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import { CanvasTexture, ExtrudeGeometry, Group, Mesh, Shape, SRGBColorSpace, Vector3 } from "three";
import { fieldKind, fieldMaterial } from "../../../games/party/board/fieldDesign.ts";
import type { BoardLanding, FieldKind } from "../../../games/party/board/fieldDesign.ts";
import type { BoardMap, BoardNode } from "../../../games/party/types.ts";
import { tilePresentationFor } from "../../../games/party/content/maps.ts";

const GLYPHS: Record<FieldKind, string> = { coin: "+3", item: "bag", rare: "★", heal: "+10", cleanse: "✚", hazard: "!", event: "?", deposit: "−3", bank: "B", warp: "↗", property: "⌂", duel: "⚔", boost: "+3", empty: "·" };
const Textures = createContext<Map<string, CanvasTexture>>(new Map());
function textureFor(text: string) {
  const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff6de"; ctx.strokeStyle = "#254353"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.roundRect(4, 4, 120, 88, 15); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#183c48"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (text === "bag") {
    ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(34, 30, 60, 49, 8); ctx.stroke();
    ctx.beginPath(); ctx.arc(64, 30, 17, Math.PI, 0); ctx.stroke();
    ctx.fillRect(49, 52, 30, 15);
  } else { ctx.font = `900 ${text.length > 3 ? 32 : text.length > 2 ? 60 : 70}px sans-serif`; ctx.fillText(text, 64, 51); }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}
export function BoardFieldResources({ children }: { children: ReactNode }) {
  const textures = useMemo(() => new Map([...new Set([...Object.values(GLYPHS), "!", "◉"])].map((g) => [g, textureFor(g)])), []);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  return <Textures.Provider value={textures}>{children}</Textures.Provider>;
}
function Mark({ glyph, position = [0, .2, .34], size = .4, facing = true }: { glyph: string; position?: [number, number, number]; size?: number; facing?: boolean }) {
  const textures = useContext(Textures);
  const face = <mesh><planeGeometry args={[size, size * .75]}/><meshBasicMaterial map={textures.get(glyph) ?? textures.get("!")} transparent depthWrite={false}/></mesh>;
  return facing ? <Billboard position={position}>{face}</Billboard> : <group position={position}>{face}</group>;
}
function CoinStack() {
  return <group position={[-.035, 0, -.09]}>
    {[0, 1, 2].map((i) => <mesh key={i} position={[i === 1 ? .055 : 0, .2 + i * .065, 0]}><cylinderGeometry args={[.18, .18, .057, 16]}/><meshStandardMaterial color={i === 2 ? "#ffe397" : "#edb44b"} metalness={.45} roughness={.3}/></mesh>)}
    <mesh position={[0, .363, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.115, .012, 4, 16]}/><meshStandardMaterial color="#ac742c"/></mesh>
    <mesh position={[0, .365, 0]}><boxGeometry args={[.025, .015, .095]}/><meshStandardMaterial color="#ac742c"/></mesh>
  </group>;
}
function Heart() {
  const shape = useMemo(() => {
    const heart = new Shape(); heart.moveTo(0, 0);
    heart.bezierCurveTo(-.9, .6, -.6, 1.3, 0, .8); heart.bezierCurveTo(.6, 1.3, .9, .6, 0, 0);
    return new ExtrudeGeometry(heart, { depth: .22, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .035, bevelThickness: .025, curveSegments: 6 });
  }, []);
  useEffect(() => () => shape.dispose(), [shape]);
  return <mesh geometry={shape} position={[0, .18, -.1]} scale={.35}><meshStandardMaterial color="#ff8299" roughness={.3} metalness={.15}/></mesh>;
}
function WarningSign() {
  const geometry = useMemo(() => {
    const shape = new Shape(); shape.moveTo(-.24, 0); shape.lineTo(.24, 0); shape.lineTo(0, .4); shape.closePath();
    return new ExtrudeGeometry(shape, { depth: .06, bevelEnabled: false });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group position={[0, .15, -.1]}>
    <mesh geometry={geometry}><meshStandardMaterial color="#ffcf6e" roughness={.7}/></mesh>
    <Mark glyph="!" position={[0, .16, .071]} size={.18} facing={false}/>
  </group>;
}
function Vault({ door }: { door: React.RefObject<Group | null> }) {
  return <group position={[0, .16, -.09]}>
    <mesh position={[0, .18, 0]}><boxGeometry args={[.45, .36, .34]}/><meshStandardMaterial color="#6f9cac" metalness={.35} roughness={.35}/></mesh>
    <group ref={door} position={[-.17, .16, .18]}>
      <mesh position={[.17, 0, 0]}><boxGeometry args={[.32, .29, .035]}/><meshStandardMaterial color="#b4d7df" metalness={.4}/></mesh>
      <mesh position={[.17, .08, .02]}><boxGeometry args={[.19, .025, .025]}/><meshBasicMaterial color="#244753"/></mesh>
      <mesh position={[.17, -.025, .031]}><torusGeometry args={[.065, .015, 5, 12]}/><meshStandardMaterial color="#35657d"/></mesh>
    </group>
  </group>;
}

export const BoardField = memo(function BoardField({ node, map, position, selected, reachable, hot, amount, onSelect, landing, motion, eventActive }: {
  node: BoardNode; map: BoardMap; position: [number, number, number]; selected: boolean; reachable: boolean; hot: boolean; amount: number;
  onSelect: (id: string) => void; landing: BoardLanding | null; motion: boolean; eventActive: boolean;
}) {
  const kind = fieldKind(map, node), material = fieldMaterial(map, node), palette = tilePresentationFor(map)[node.type];
  const color = kind === "cleanse" ? "#6be1de" : `#${palette.color.toString(16).padStart(6, "0")}`;
  const artwork = useRef<Group>(null), lid = useRef<Group>(null), door = useRef<Group>(null), sign = useRef<Group>(null), rim = useRef<Mesh>(null), cracks = useRef<Group>(null);
  const glyph = kind === "event" && landing ? landing.icon : GLYPHS[kind];
  useFrame(({ clock }) => {
    if (!artwork.current) return;
    const age = landing ? (performance.now() - landing.startedAt) / 1000 : 9;
    const action = motion && age < 1.65 ? Math.sin(Math.min(1, age / 1.65) * Math.PI) : 0;
    artwork.current.position.y = kind === "coin" || kind === "boost" ? action * .3 : 0;
    artwork.current.rotation.y = kind === "warp" ? action * Math.PI * 2 : 0;
    artwork.current.scale.setScalar(1 + (kind === "heal" || kind === "cleanse" ? action * .12 : 0));
    if (lid.current) lid.current.rotation.x = -action * 1.75;
    if (door.current) door.current.rotation.y = -action * 1.2;
    if (sign.current) sign.current.rotation.y = action * Math.PI;
    if (cracks.current) cracks.current.children.forEach((object) => { if (object instanceof Mesh && "color" in object.material) object.material.color.set(action > .1 ? "#ff493e" : "#723a43"); });
    if (rim.current) rim.current.scale.setScalar(motion && (kind === "rare" || eventActive) ? 1 + Math.sin(clock.elapsedTime * 2.5) * .035 : 1);
  });
  return <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}>
    <mesh><cylinderGeometry args={[.46, .49, .2, material.segments]}/><meshStandardMaterial color={material.base} roughness={material.roughness}/></mesh>
    <mesh position={[0, .082, 0]}><cylinderGeometry args={[.43, .43, .06, kind === "rare" ? 6 : 20]}/><meshStandardMaterial color={hot ? "#91c75b" : color} roughness={.65} emissive={reachable ? "#c4ffd5" : selected ? "#ffd391" : "#000"} emissiveIntensity={.35}/></mesh>
    <mesh ref={rim} rotation={[-Math.PI / 2, 0, 0]} position={[0, .122, 0]}><torusGeometry args={[.447, .026, 5, material.segments]}/><meshStandardMaterial color={selected || reachable ? "#fff1a5" : material.trim} roughness={material.roughness}/></mesh>
    {material.kind === "wood" && [-1, 1].map((i) => <mesh key={i} position={[i * .145, .116, 0]}><boxGeometry args={[.012, .005, .74]}/><meshStandardMaterial color="#85684c" transparent opacity={.35}/></mesh>)}
    {material.kind === "stone" && <mesh position={[0, -.005, .485]}><boxGeometry args={[.014, .12, .007]}/><meshStandardMaterial color="#414d5a"/></mesh>}
    <group ref={artwork}>
      {(kind === "coin" || kind === "boost") && <CoinStack/>}
      {(kind === "item" || kind === "rare") && <group position={[0, .15, -.1]}>
        <mesh position={[0, .14, 0]}><boxGeometry args={[.42, .28, .35]}/><meshStandardMaterial color={kind === "rare" ? "#ad77d4" : "#619fcd"}/></mesh>
        <mesh position={[0, .14, .182]}><boxGeometry args={[.065, .28, .016]}/><meshStandardMaterial color="#ffe2a0"/></mesh>
        <group ref={lid} position={[0, .3, -.18]}><mesh position={[0, 0, .18]}><boxGeometry args={[.47, .07, .39]}/><meshStandardMaterial color={kind === "rare" ? "#d4b6f2" : "#aed3e8"}/></mesh></group>
      </group>}
      {kind === "heal" && <Heart/>}
      {kind === "cleanse" && <>
        <mesh position={[0, .125, -.06]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.28, 20]}/><meshStandardMaterial color="#42d9da" emissive="#3da6a6" emissiveIntensity={.25}/></mesh>
        {[-1, 0, 1].map((i) => <mesh key={i} position={[i * .19, .2, -.12 - (i === 0 ? .13 : 0)]} scale={[1, .55, .7]}><dodecahedronGeometry args={[.12, 0]}/><meshStandardMaterial color="#bbfff3" roughness={.7}/></mesh>)}
      </>}
      {kind === "hazard" && <>
        <group ref={cracks}>{[-1, 1].map((i) => <mesh key={i} position={[i * .24, .117, .01]} rotation={[0, i * .6, 0]}><boxGeometry args={[.018, .006, .27]}/><meshBasicMaterial color="#723a43"/></mesh>)}</group>
        {[-1, 1].map((i) => <mesh key={i} position={[i * .3, .2, -.12]}><coneGeometry args={[.058, .18, 4]}/><meshStandardMaterial color="#bf5b47"/></mesh>)}
        <WarningSign/>
      </>}
      {kind === "event" && <group ref={sign} position={[0, 0, -.08]} rotation={[0, 0, -.13]}>
        <mesh position={[0, .29, 0]}><boxGeometry args={[.05, .34, .05]}/><meshStandardMaterial color={material.base}/></mesh>
        <mesh position={[0, .48, 0]}><boxGeometry args={[.36, .29, .075]}/><meshStandardMaterial color="#8d65b1"/></mesh>
        <Mark glyph={glyph} position={[0, .48, .044]} size={.3} facing={false}/>
      </group>}
      {(kind === "deposit" || kind === "bank") && <Vault door={door}/>}
      {kind === "warp" && <group position={[0, .135, -.06]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.29, 24]}/><meshBasicMaterial color="#233d76"/></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.29, .035, 6, 24]}/><meshStandardMaterial color="#8aeced" emissive="#3aa3c4" emissiveIntensity={.3}/></mesh>
        {[.08, .15, .22].map((r, i) => <mesh key={r} rotation={[-Math.PI / 2, 0, i * .9]} position={[0, .012 + i * .002, 0]}><torusGeometry args={[r, .012, 4, 16, Math.PI * 1.5]}/><meshBasicMaterial color="#a4d9ff"/></mesh>)}
      </group>}
      {kind === "property" && <mesh position={[0, .29, -.06]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[.28, .3, 4]}/><meshStandardMaterial color={material.base}/></mesh>}
    </group>
    {(kind === "coin" || kind === "boost") && <mesh position={[.26, .118, .12]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[.063, .012, 4, 12]}/><meshStandardMaterial color="#a78138"/></mesh>}
    <Mark glyph={glyph}/>
    {(reachable || selected || amount > 0) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .12, 0]}><ringGeometry args={[.49, .56, 24]}/><meshBasicMaterial color={amount > 0 ? "#ff9273" : "#fff4a7"}/></mesh>}
    {amount > 0 && <Html position={[0, .8, 0]} center style={{ pointerEvents: "none" }}><span className="pp-world-damage">−{amount}</span></Html>}
  </group>;
});

export function LandingEffects({ landing, position, motion, onProject }: { landing: BoardLanding; position: [number, number, number]; motion: boolean; onProject: (x: number, y: number) => void }) {
  const particles = useRef<Group>(null), ring = useRef<Mesh>(null);
  const color = landing.kind === "hazard" ? "#ff796c" : landing.kind === "heal" || landing.kind === "cleanse" ? "#92ffce" : landing.kind === "warp" ? "#8ccaff" : "#ffe499";
  const source = useMemo(() => new Vector3(position[0], position[1] + .7, position[2]), [position]);
  useFrame(({ camera, size }) => {
    const projected = source.clone().project(camera); onProject((projected.x + 1) * size.width / 2, (1 - projected.y) * size.height / 2);
    const t = Math.min(1, (performance.now() - landing.startedAt) / 1800);
    if (ring.current) { ring.current.scale.setScalar(motion ? 1 + t * 2.4 : 1.25); ring.current.visible = t < .8; }
    if (particles.current) particles.current.children.forEach((p, i) => { const angle = i * Math.PI / 4; p.position.set(Math.cos(angle) * (.1 + t * .65), .2 + t * (landing.kind === "deposit" ? -.15 : 1.1), Math.sin(angle) * (.1 + t * .65)); p.scale.setScalar(Math.max(.01, 1 - t)); });
  });
  return <group position={position}>
    <mesh ref={ring} position={[0, .17, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.49, .56, 28]}/><meshBasicMaterial color={color} transparent opacity={.6} depthWrite={false}/></mesh>
    {motion && <group ref={particles}>{Array.from({ length: 8 }, (_, i) => <mesh key={i}><sphereGeometry args={[.045, 6, 4]}/><meshBasicMaterial color={color}/></mesh>)}</group>}
    <Html position={[0, 1.2, 0]} center zIndexRange={[22, 21]} style={{ pointerEvents: "none" }}><span className={`pp-field-result pp-field-result-${landing.kind}`}><b>{landing.icon} {landing.label}</b>{landing.cleansed && <small className="pp-cleanse-dissolve">☢ → ○ ○ ○</small>}</span></Html>
  </group>;
}
