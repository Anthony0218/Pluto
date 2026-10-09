import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { memo, Suspense, useEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Line, OrbitControls, PerformanceMonitor, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import type { BoardCell, BoardLayer, Coord, EffectKind, PieceModelAccent, PieceModelBase } from "@/games/chess/custom/engine/types";
import { cameraPositionFor, type Chess3DCameraView, type Chess3DPieceSkin } from "@/games/chess/3d/chess3dAppearance";
import { cellToWorld } from "@/games/chess/3d/chess3dUtils";
import ChessPiece3D, { type PieceMotion, type PieceSet } from "./ChessPiece3D";
import ChessSquare3D, { type Square3DMark, type Square3DPalette } from "./ChessSquare3D";
import { animateSharedMaterials } from "./sharedResources";

export interface Board3DPiece {
  id: string;
  x: number;
  y: number;
  z?: number;
  base: PieceModelBase;
  set: PieceSet;
  accent?: PieceModelAccent;
  tint?: string;
  scale?: number;
  captured?: boolean;
  inCheck?: boolean;
  checkmated?: boolean;
  promotedKey?: number;
  motion?: PieceMotion;
  /** Shown as a ring under the piece when more than two teams play. */
  teamColor?: string;
}

export interface Board3DEffect {
  id: number;
  kind: EffectKind;
  at: Coord;
  to?: Coord;
}

export interface Board3DTheme extends Square3DPalette {
  frame: string;
  base: string;
  trim: string;
  keyLight: string;
  rimLight: string;
}

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

export type CameraCommand = { id: number; kind: "zoomIn" | "zoomOut" | "reset" };
export type CameraShakeKind = "none" | "capture" | "check" | "checkmate" | "royal";
export type RenderQuality = "low" | "high";

interface SceneProps {
  width: number;
  height: number;
  cells: BoardCell[];
  layers?: BoardLayer[];
  layerSpacing?: number;
  visibleLayers?: number[];
  focusLayer?: number;
  pieces: Board3DPiece[];
  marks: Map<string, Square3DMark>;
  selectedPieceId?: string | null;
  theme: Board3DTheme;
  skin: Chess3DPieceSkin;
  cameraView: Chess3DCameraView;
  cameraCommand?: CameraCommand;
  cameraShake?: { id: number; kind: CameraShakeKind };
  autoOrbit?: boolean;
  enablePan?: boolean;
  reducedMotion?: boolean;
  quality?: RenderQuality;
  effects?: Board3DEffect[];
  trail?: Coord[] | null;
  trailJump?: boolean;
  /** Dark floor and drifting motes around the board (off when the page supplies its own backdrop). */
  atmosphere?: boolean;
  /** Multiplies the camera preset distance (e.g. to leave room for overlaid controls). */
  cameraScale?: number;
  onCellClick: (x: number, y: number, z?: number) => void;
}

/* ------------------------------------------------------------ Lighting */

function Lights({ theme, size, quality }: { theme: Board3DTheme; size: number; quality: RenderQuality }) {
  const extent = size * 0.75;
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight intensity={0.55} color={theme.keyLight} groundColor="#120d0a" />
      <directionalLight
        position={[size * 0.6, size * 1.3, size * 0.75]}
        intensity={2.2}
        color={theme.keyLight}
        castShadow
        shadow-mapSize-width={quality === "high" ? 2048 : 1024}
        shadow-mapSize-height={quality === "high" ? 2048 : 1024}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-size, size * 0.45, -size * 0.8]} intensity={0.9} color={theme.rimLight} />
      {/* Baked once: gives metallic pieces and polished squares believable reflections without an HDR download. */}
      <Environment resolution={64} frames={1} environmentIntensity={0.35}>
        <Lightformer form="rect" intensity={1.6} color={theme.keyLight} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#7dd3fc" position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1} color={theme.rimLight} position={[6, 2, -2]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
      </Environment>
    </>
  );
}

function BoardFurniture({ width, height, theme }: { width: number; height: number; theme: Board3DTheme }) {
  // World x spans ranks (height), world z spans files (width).
  return (
    <>
      <mesh position={[0, -0.13, 0]} receiveShadow castShadow>
        <boxGeometry args={[height + 0.9, 0.24, width + 0.9]} />
        <meshStandardMaterial color={theme.frame} roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.005, 0]} receiveShadow>
        <boxGeometry args={[height + 0.32, 0.055, width + 0.32]} />
        <meshStandardMaterial color={theme.trim} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, -0.58, 0]} receiveShadow castShadow>
        <boxGeometry args={[height + 3.8, 0.72, width + 3.8]} />
        <meshStandardMaterial color={theme.base} roughness={0.6} metalness={0.08} />
      </mesh>
      <mesh position={[0, -1.03, 0]} receiveShadow>
        <boxGeometry args={[height + 1.8, 0.28, width + 1.8]} />
        <meshStandardMaterial color={theme.base} roughness={0.72} />
      </mesh>
    </>
  );
}

function Atmosphere({ size, theme, sparkles }: { size: number; theme: Board3DTheme; sparkles: boolean }) {
  useGameLanguage();
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.18, 0]} receiveShadow>
        <circleGeometry args={[size * 2.2, 64]} />
        <meshStandardMaterial color="#0a0b0d" roughness={0.95} metalness={0} />
      </mesh>
      {sparkles && <Sparkles count={45} scale={[size * 1.9, 3.5, size * 1.9]} position={[0, 1.4, 0]} size={2.2} speed={0.18} opacity={0.35} color={theme.trim} />}
    </>
  );
}

/* ----------------------------------------------------------- Overlays */

function MoveTrail({ path, width, height, layers = [], jump, spacing = 2.8 }: { path: Coord[]; width: number; height: number; layers?: BoardLayer[]; jump: boolean; spacing?: number }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const geometry = useMemo(() => {
    if (path.length < 2) return null;
    const points = path.map((coord) => {
      const layer = layers.find((entry) => entry.z === (coord.z ?? 0));
      const [x, , z] = cellToWorld(coord.x, coord.y, layer?.width ?? width, layer?.height ?? height);
      return new THREE.Vector3(x, (coord.z ?? 0) * spacing + 0.18, z);
    });
    if (points.length === 2) {
      const mid = points[0].clone().lerp(points[1], 0.5);
      mid.y += jump ? 1.05 : 0.12;
      points.splice(1, 0, mid);
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.022, 8, false);
  }, [path, width, height, layers, jump, spacing]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.opacity = 0.26 + Math.sin(state.clock.elapsedTime * 4) * 0.08;
  });
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial ref={materialRef} color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.6} transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

const EFFECT_STYLE: Record<EffectKind, { color: string; beam?: boolean; scale: number; duration: number }> = {
  capture: { color: "#ef4444", scale: 1.5, duration: 0.7 },
  royalCapture: { color: "#fbbf24", scale: 2.6, duration: 1.2 },
  promotion: { color: "#fcd34d", beam: true, scale: 1.4, duration: 1.1 },
  portal: { color: "#a78bfa", scale: 1.6, duration: 0.9 },
  spawn: { color: "#2dd4bf", beam: true, scale: 1.3, duration: 1 },
  transform: { color: "#fbbf24", beam: true, scale: 1.5, duration: 1.1 },
  pulse: { color: "#38bdf8", scale: 1.6, duration: 0.9 },
  glow: { color: "#f59e0b", scale: 1.2, duration: 1.2 },
  shake: { color: "#f97316", scale: 2, duration: 0.8 },
  tile: { color: "#e5e7eb", scale: 1.3, duration: 0.8 },
};

const RING = new THREE.RingGeometry(0.4, 0.5, 48);
const BEAM = new THREE.CylinderGeometry(0.34, 0.42, 2.2, 24, 1, true);

function EffectBurst({ effect, width, height, onDone }: { effect: Board3DEffect; width: number; height: number; onDone: (id: number) => void }) {
  useGameLanguage();
  const style = EFFECT_STYLE[effect.kind];
  const ringRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const beamMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const progress = useRef(0);
  const [x, , z] = cellToWorld(effect.at.x, effect.at.y, width, height);

  useFrame((_, delta) => {
    progress.current = Math.min(1, progress.current + delta / style.duration);
    const t = progress.current;
    ringRef.current?.scale.setScalar(0.5 + t * style.scale);
    if (ringMaterialRef.current) ringMaterialRef.current.opacity = (1 - t) * 0.9;
    beamRef.current?.scale.set(1, 0.2 + Math.sin(t * Math.PI), 1);
    if (beamMaterialRef.current) beamMaterialRef.current.opacity = Math.sin(t * Math.PI) * 0.35;
    if (t >= 1) onDone(effect.id);
  });

  const glow = { color: style.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false } as const;
  return (
    <group position={[x, 0.1, z]}>
      <mesh ref={ringRef} geometry={RING} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial ref={ringMaterialRef} {...glow} opacity={0.9} />
      </mesh>
      {gameUi(style.beam && (
        <mesh ref={beamRef} geometry={BEAM} position={[0, 1.1, 0]}>
          <meshBasicMaterial ref={beamMaterialRef} {...glow} opacity={0} />
        </mesh>
      ))}
      {effect.kind === "royalCapture" && <pointLight color="#fbbf24" intensity={4} distance={4} position={[0, 0.8, 0]} />}
    </group>
  );
}

function EffectLayer({ effects, width, height }: { effects: Board3DEffect[]; width: number; height: number }) {
  useGameLanguage();
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const active = effects.filter((effect) => !done.has(effect.id));
  // Portal effects also flash at the exit square.
  const expanded = active.flatMap((effect) => (effect.kind === "portal" && effect.to && (effect.to.z ?? 0) === (effect.at.z ?? 0) ? [effect, { ...effect, id: effect.id + 0.5, at: effect.to, to: undefined }] : [effect]));
  return (
    <>
      {expanded.map((effect) => (
        <EffectBurst key={effect.id} effect={effect} width={width} height={height} onDone={(id) => setDone((current) => new Set(current).add(id).add(Math.floor(id)))} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------- Camera */

function CameraRig({
  view,
  size,
  scale,
  centerY = 0.15,
  command,
  controlsRef,
  interactingRef,
}: {
  view: Chess3DCameraView;
  size: number;
  scale: number;
  centerY?: number;
  command?: CameraCommand;
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  interactingRef: MutableRefObject<boolean>;
}) {
  const { camera } = useThree();
  // Portrait canvases need a longer lens distance to fit the board's width.
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height));
  const distance = scale * Math.min(1.8, Math.max(1, 1.15 / aspect));
  const from = useRef(new THREE.Vector3());
  const to = useRef(new THREE.Vector3());
  const progress = useRef(1);
  const lastView = useRef(-1);
  const lastCommand = useRef(-1);

  const flyTo = (target: THREE.Vector3) => {
    from.current.copy(camera.position);
    to.current.copy(target);
    progress.current = 0;
  };

  useEffect(() => {
    if (lastView.current === view.id) return;
    const first = lastView.current === -1;
    lastView.current = view.id;
    const target = new THREE.Vector3(...cameraPositionFor(view.preset, size)).multiplyScalar(distance).add(new THREE.Vector3(0, centerY - 0.15, 0));
    if (first) {
      camera.position.copy(target);
      camera.lookAt(0, centerY, 0);
    } else flyTo(target);
    // flyTo only touches refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, size, distance, camera]);

  useEffect(() => {
    if (!command || lastCommand.current === command.id) return;
    lastCommand.current = command.id;
    const controls = controlsRef.current;
    const center = controls?.target ?? new THREE.Vector3(0, centerY, 0);
    if (command.kind === "reset") {
      controls?.target.set(0, centerY, 0);
      flyTo(new THREE.Vector3(...cameraPositionFor(view.preset, size)).multiplyScalar(distance).add(new THREE.Vector3(0, centerY - 0.15, 0)));
      return;
    }
    const offset = camera.position.clone().sub(center);
    offset.multiplyScalar(command.kind === "zoomIn" ? 0.8 : 1.25);
    const min = 4;
    const max = size * 2.6 * distance;
    offset.setLength(THREE.MathUtils.clamp(offset.length(), min, max));
    flyTo(center.clone().add(offset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command, camera, controlsRef, view.preset, size, distance]);

  useFrame((_, delta) => {
    if (progress.current >= 1 || interactingRef.current) return;
    progress.current = Math.min(1, progress.current + delta / 0.6);
    const t = progress.current;
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(from.current, to.current, eased);
    controlsRef.current?.update();
  });
  return null;
}

function CameraShake({ shake, reducedMotion }: { shake?: { id: number; kind: CameraShakeKind }; reducedMotion: boolean }) {
  const { camera } = useThree();
  const state = useRef({ id: -1, elapsed: 0, active: false, kind: "none" as CameraShakeKind, offset: new THREE.Vector3() });

  useEffect(() => {
    if (!shake || shake.id === state.current.id || reducedMotion) return;
    state.current.id = shake.id;
    state.current.kind = shake.kind;
    state.current.elapsed = 0;
    state.current.active = shake.kind !== "none";
  }, [shake, reducedMotion]);

  useFrame((_, delta) => {
    const current = state.current;
    camera.position.sub(current.offset);
    current.offset.set(0, 0, 0);
    if (!current.active) return;
    current.elapsed += delta;
    const duration = current.kind === "royal" || current.kind === "checkmate" ? 0.7 : current.kind === "check" ? 0.5 : 0.32;
    const t = current.elapsed / duration;
    if (t >= 1) {
      current.active = false;
      return;
    }
    const strength = (1 - t) * (current.kind === "royal" || current.kind === "checkmate" ? 0.12 : current.kind === "check" ? 0.06 : 0.08);
    current.offset.set(Math.sin(current.elapsed * 58) * strength, Math.sin(current.elapsed * 43) * strength * 0.55, Math.cos(current.elapsed * 52) * strength);
    camera.position.add(current.offset);
  });
  return null;
}

function MaterialAnimator({ reducedMotion }: { reducedMotion: boolean }) {
  useFrame((state) => animateSharedMaterials(state.clock.elapsedTime, reducedMotion));
  return null;
}

/* -------------------------------------------------------------- Scene */

function Scene(props: SceneProps & { controlsRef: MutableRefObject<OrbitControlsImpl | null> }) {
  useGameLanguage();
  const { width, height, cells, layers = [], layerSpacing = 2.8, visibleLayers, focusLayer, pieces, marks, selectedPieceId, theme, skin, cameraView, cameraCommand, cameraShake, autoOrbit, enablePan, reducedMotion = false, quality = "high", effects = [], trail, trailJump, atmosphere = true, cameraScale = 1, onCellClick, controlsRef } = props;
  const interactingRef = useRef(false);
  const maxZ = Math.max(0, ...layers.map((layer) => layer.z));
  const size = Math.max(width, height, maxZ * layerSpacing + 3);
  const centerY = maxZ * layerSpacing / 2 + 0.15;
  const palette = useMemo(() => ({ light: theme.light, dark: theme.dark, roughness: theme.roughness, metalness: theme.metalness }), [theme.light, theme.dark, theme.roughness, theme.metalness]);
  const selected = pieces.find((piece) => piece.id === selectedPieceId);
  const allLayers = [{ z: 0, id: "ground", width, height, cells }, ...layers];
  const crossLayerLinks = selected ? [...marks].flatMap(([key, mark]) => {
    if (mark !== "move" && mark !== "capture" && mark !== "special") return [];
    const [x, y, z = 0] = key.split(",").map(Number);
    if (z === (selected.z ?? 0) || (visibleLayers && (!visibleLayers.includes(z) || !visibleLayers.includes(selected.z ?? 0)))) return [];
    const fromLayer = allLayers.find((layer) => layer.z === (selected.z ?? 0));
    const toLayer = allLayers.find((layer) => layer.z === z);
    if (!fromLayer || !toLayer) return [];
    const [sx, , sz] = cellToWorld(selected.x, selected.y, fromLayer.width, fromLayer.height);
    const [tx, , tz] = cellToWorld(x, y, toLayer.width, toLayer.height);
    return [{ key, color: mark === "capture" ? "#ef4444" : mark === "special" ? "#fbbf24" : "#38bdf8", from: [sx, (selected.z ?? 0) * layerSpacing + 0.2, sz] as [number, number, number], to: [tx, z * layerSpacing + 0.2, tz] as [number, number, number] }];
  }) : [];

  return (
    <>
      <Lights theme={theme} size={size} quality={quality} />
      {allLayers.filter((layer) => !visibleLayers || visibleLayers.includes(layer.z)).map((layer) => (
        <group key={layer.id} position={[0, layer.z * layerSpacing, 0]}>
          <BoardFurniture width={layer.width} height={layer.height} theme={theme} />
          {layer.cells.map((cell) => (
            <ChessSquare3D key={`${cell.x},${cell.y}`} cell={cell} width={layer.width} height={layer.height} palette={palette} mark={marks.get(`${cell.x},${cell.y}${layer.z ? `,${layer.z}` : ""}`)} onClick={(x, y) => onCellClick(x, y, layer.z)} />
          ))}
          <Suspense fallback={null}>
            {pieces.filter((piece) => (piece.z ?? 0) === layer.z).map((piece) => (
              <ChessPiece3D key={piece.id} x={piece.x} y={piece.y} boardWidth={layer.width} boardHeight={layer.height} base={piece.base} set={piece.set} skin={skin} accent={piece.accent} tint={piece.tint} scale={piece.scale} selected={piece.id === selectedPieceId && !piece.captured} captured={Boolean(piece.captured)} promotedKey={piece.promotedKey} inCheck={Boolean(piece.inCheck)} checkmated={Boolean(piece.checkmated)} motion={piece.motion} teamColor={piece.teamColor} reducedMotion={reducedMotion} onClick={(x, y) => onCellClick(x, y, layer.z)} />
            ))}
          </Suspense>
          {!reducedMotion && <EffectLayer effects={[...effects.filter((effect) => (effect.at.z ?? 0) === layer.z), ...effects.filter((effect) => effect.kind === "portal" && effect.to && (effect.to.z ?? 0) === layer.z && (effect.at.z ?? 0) !== layer.z).map((effect) => ({ ...effect, id: effect.id + 0.5, at: effect.to!, to: undefined }))]} width={layer.width} height={layer.height} />}
          {focusLayer !== undefined && focusLayer !== layer.z && <mesh position={[0, 1.45, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[layer.height + 1, layer.width + 1]} /><meshBasicMaterial color="#050608" transparent opacity={0.52} depthWrite={false} side={THREE.DoubleSide} /></mesh>}
        </group>
      ))}
      {atmosphere && <Atmosphere size={size} theme={theme} sparkles={quality === "high" && !reducedMotion} />}
      {crossLayerLinks.map((link) => <Line key={link.key} points={[link.from, link.to]} color={link.color} lineWidth={2} transparent opacity={0.48} depthWrite={false} />)}
      {trail && trail.length > 1 && !reducedMotion && <MoveTrail path={trail} width={width} height={height} layers={layers} jump={Boolean(trailJump)} spacing={layerSpacing} />}
      <MaterialAnimator reducedMotion={reducedMotion} />
      <CameraRig view={cameraView} size={size} scale={cameraScale} centerY={centerY} command={cameraCommand} controlsRef={controlsRef} interactingRef={interactingRef} />
      <CameraShake shake={cameraShake} reducedMotion={reducedMotion} />
      <OrbitControls
        ref={controlsRef}
        target={[0, centerY, 0]}
        enablePan={enablePan}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={size * 2.6 * cameraScale * 1.8}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={Boolean(autoOrbit) && !reducedMotion}
        autoRotateSpeed={0.55}
        onStart={() => {
          interactingRef.current = true;
        }}
        onEnd={() => {
          interactingRef.current = false;
        }}
      />
    </>
  );
}

/** The shared 3D board for Chess Custom play and simulation. */
function Board3DCanvas(props: SceneProps & { className?: string }) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [dpr, setDpr] = useState(1.5);
  const size = Math.max(props.width, props.height);
  const initial = cameraPositionFor(props.cameraView.preset, size).map((value) => value * (props.cameraScale ?? 1)) as [number, number, number];
  return (
    <Canvas
      className={props.className}
      shadows
      dpr={dpr}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.shadowMap.type = THREE.PCFShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
      camera={{ position: initial, fov: 44, near: 0.1, far: 200 }}
    >
      {/* Adaptive resolution: drop pixel ratio on slow devices, restore when smooth. */}
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(props.quality === "low" ? 1.25 : 1.75)} />
      <Scene {...props} controlsRef={controlsRef} />
    </Canvas>
  );
}

export default memo(Board3DCanvas);
