import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Quaternion, Vector3 } from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { PieceModelView } from "@/components/chess3d/ChessPiece3D";
import { dividendPosition, flatPosition, getDividendPolygon, interpolate, projectSectorPointToSphere, snubCubeVertices, stretchAt } from "@/games/chess/janmann/geometry";
import type { DividendId, Vec3 } from "@/games/chess/janmann/config";
import { NODES, TOPOLOGY } from "@/games/chess/janmann/topology";
import type { Control, GameState, Piece } from "@/games/chess/janmann/rules";
import { ui } from "@/i18n/ui";

type BoardProps = {
  state: GameState;
  control: Record<DividendId, Control>;
  progress: number;
  selected: DividendId | null;
  targets: DividendId[];
  eligible: DividendId[];
  showControl: boolean;
  cameraReset: number;
  onSelect: (id: DividendId) => void;
};

export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="status" className="p-6 text-sm text-amber-100">{ui("3D view unavailable. Use the sector board below to play.")}</div> : this.props.children;
  }
}

function Dividend({ id, piece, control, progress, selected, target, eligible, showControl, onSelect }: {
  id: DividendId; piece?: Piece; control: Control; progress: number; selected: boolean; target: boolean; eligible: boolean; showControl: boolean; onSelect: BoardProps["onSelect"];
}) {
  const node = NODES[id];
  const { geometry, outline, flat, sphere, flatOutline, sphereOutline } = useMemo(() => {
    const polygon = getDividendPolygon(node.dividendIndex);
    const baryTriangles: Vec3[] = [];
    // Subdivide each polygon fan so projected tiles curve along spherical seams.
    function subdivide(a: Vec3, b: Vec3, c: Vec3, depth: number) {
      if (!depth) { baryTriangles.push(a, b, c); return; }
      const ab = interpolate(a, b, .5), bc = interpolate(b, c, .5), ca = interpolate(c, a, .5);
      subdivide(a, ab, ca, depth - 1); subdivide(ab, b, bc, depth - 1);
      subdivide(ca, bc, c, depth - 1); subdivide(ab, bc, ca, depth - 1);
    }
    polygon.forEach((point, i) => subdivide(node.barycentric, point, polygon[(i + 1) % polygon.length], 2));
    const flat = new Float32Array(baryTriangles.flatMap((bary) => flatPosition(node.sectorId, bary)));
    const sphere = new Float32Array(baryTriangles.flatMap((bary) => projectSectorPointToSphere(node.sectorId, bary)));
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(flat.slice(), 3));
    const boundary = polygon.flatMap((point, i) => Array.from({ length: 5 }, (_, step) => interpolate(point, polygon[(i + 1) % polygon.length], step / 5)));
    const flatOutline = new Float32Array(boundary.flatMap((bary) => {
      const position = flatPosition(node.sectorId, bary); position[1] += .012; return position;
    }));
    const sphereOutline = new Float32Array(boundary.flatMap((bary) => projectSectorPointToSphere(node.sectorId, bary, 5.008)));
    const outline = new BufferGeometry();
    outline.setAttribute("position", new Float32BufferAttribute(flatOutline.slice(), 3));
    return { geometry, outline, flat, sphere, flatOutline, sphereOutline };
  }, [node]);
  useEffect(() => () => { geometry.dispose(); outline.dispose(); }, [geometry, outline]);
  useEffect(() => {
    const attr = geometry.getAttribute("position");
    for (let i = 0; i < flat.length; i++) attr.array[i] = flat[i] + (sphere[i] - flat[i]) * progress;
    attr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const edges = outline.getAttribute("position");
    for (let i = 0; i < flatOutline.length; i++) edges.array[i] = flatOutline[i] + (sphereOutline[i] - flatOutline[i]) * progress;
    edges.needsUpdate = true;
    outline.computeBoundingSphere();
  }, [geometry, outline, flat, sphere, flatOutline, sphereOutline, progress]);
  const position = dividendPosition(id, progress);
  const quaternion = new Quaternion().slerp(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...projectSectorPointToSphere(node.sectorId, node.barycentric)).normalize()), progress);
  const color = control === "void" ? "#10131c" : selected ? "#f1c878" : target ? "#5dccbb" : showControl && control === "contested" ? "#9373ab" : showControl && control === "white" ? "#d0be93" : showControl && control === "black" ? "#596c8c" : (node.dividendIndex + node.sectorId) % 2 ? "#4f4540" : "#85705a";
  const click = () => onSelect(id);
  return <group>
    <mesh geometry={geometry} onClick={(event) => { event.stopPropagation(); click(); }}>
      <meshStandardMaterial color={color} side={DoubleSide} metalness={.25} roughness={.55} transparent opacity={control === "void" ? .2 : 1} emissive={selected || target || eligible ? color : "#000000"} emissiveIntensity={selected ? .4 : .1} />
    </mesh>
    <lineLoop geometry={outline}><lineBasicMaterial color={selected ? "#ffe5aa" : "#b69a73"} transparent opacity={control === "void" ? .2 : .55} /></lineLoop>
    <group position={position} quaternion={quaternion} onClick={(event) => { event.stopPropagation(); click(); }}>
      {control !== "void" && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .018, 0]}>
        <ringGeometry args={[.29, .31, 32]} /><meshBasicMaterial color={eligible ? "#e8b96f" : target ? "#8bf5cf" : "#f4dfba"} transparent opacity={eligible || target ? .95 : .28} side={DoubleSide} />
      </mesh>}
      {piece && <Suspense fallback={<mesh position={[0, .2, 0]}><coneGeometry args={[.18, .5, 8]} /><meshStandardMaterial color={piece.side === "white" ? "#f7e5ba" : "#171e30"} /></mesh>}>
        <PieceModelView base={piece.kind} set={piece.side === "white" ? "light" : "dark"} skin="gilded" scale={.65} />
      </Suspense>}
      {target && !piece && <mesh position={[0, .06, 0]}><sphereGeometry args={[.11, 12, 12]} /><meshBasicMaterial color="#8bf5cf" /></mesh>}
    </group>
  </group>;
}

function ResetCamera({ token }: { token: number }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => { camera.position.set(10, 9, 12); camera.lookAt(0, 0, 0); }, [camera, token]);
  return null;
}

function SnubCube({ progress }: { progress: number }) {
  const geometry = useMemo(() => new ConvexGeometry(snubCubeVertices().map((point) => new Vector3(...point))), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group rotation={[Math.PI / 2, 0, Math.PI / 4]} position={[0, -.5, 0]} scale={.28}>
    <mesh geometry={geometry} scale={[1, 1, stretchAt(progress)]}>
      <meshBasicMaterial wireframe color="#edb968" transparent opacity={.6} />
    </mesh>
  </group>;
}

export default function JanmannBoard(props: BoardProps) {
  const { state, control, progress, selected, targets, eligible, showControl, onSelect } = props;
  return <SceneBoundary>
    <Canvas camera={{ position: [10, 9, 12], fov: 42, near: .1, far: 100 }} dpr={[1, 1.5]} style={{ height: "100%", minHeight: 420 }} fallback={<p className="p-6">{ui("3D view unavailable. Use the sector board below to play.")}</p>}>
      <color attach="background" args={["#10141d"]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[3, 12, 8]} intensity={3.2} color="#ffddb0" />
      <directionalLight position={[-8, 2, -5]} intensity={2} color="#a3bbdf" />
      {TOPOLOGY.map((node) => <Dividend key={node.id} id={node.id} piece={state.pieces.find((piece) => piece.at === node.id)} control={control[node.id]} progress={progress} selected={selected === node.id} target={targets.includes(node.id)} eligible={eligible.includes(node.id)} showControl={showControl} onSelect={onSelect} />)}
      <SnubCube progress={progress} />
      {progress < .5 && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.05, 0]}>
        <planeGeometry args={[4, 4]} /><meshStandardMaterial color="#b6894f" wireframe transparent opacity={1 - 2 * progress} />
      </mesh>}
      <OrbitControls makeDefault minDistance={8} maxDistance={32} enablePan={false} />
      <ResetCamera token={props.cameraReset} />
    </Canvas>
  </SceneBoundary>;
}
