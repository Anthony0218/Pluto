import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { PieceModelAccent, PieceModelBase } from "@/games/chess/custom/engine/types";
import { cellToWorld } from "@/games/chess/3d/chess3dUtils";
import type { Chess3DPieceSkin } from "@/games/chess/3d/chess3dAppearance";

export type PieceSet = "light" | "dark";
/** How the piece travels to a new square. */
export type PieceMotion = "slide" | "jump" | "teleport" | "instant";

type Props = {
  x: number;
  y: number;
  boardWidth: number;
  boardHeight: number;
  base: PieceModelBase;
  set: PieceSet;
  skin: Chess3DPieceSkin;
  accent?: PieceModelAccent;
  tint?: string;
  scale?: number;
  selected: boolean;
  captured: boolean;
  /** Changes whenever the piece is promoted/transformed, replaying the rise animation. */
  promotedKey?: number;
  inCheck: boolean;
  checkmated: boolean;
  motion?: PieceMotion;
  teamColor?: string;
  reducedMotion?: boolean;
  onClick: (x: number, y: number) => void;
};

const MODEL_PATHS: Record<PieceSet, Record<PieceModelBase, string>> = {
  light: {
    pawn: "/models/chess/white/pawn.glb",
    knight: "/models/chess/white/knight.glb",
    bishop: "/models/chess/white/bishop.glb",
    rook: "/models/chess/white/rook.glb",
    queen: "/models/chess/white/queen.glb",
    king: "/models/chess/white/king.glb",
  },
  dark: {
    pawn: "/models/chess/black/pawn.glb",
    knight: "/models/chess/black/knight.glb",
    bishop: "/models/chess/black/bishop.glb",
    rook: "/models/chess/black/rook.glb",
    queen: "/models/chess/black/queen.glb",
    king: "/models/chess/black/king.glb",
  },
};

const PIECE_HEIGHT: Record<PieceModelBase, number> = { pawn: 0.78, knight: 1.02, bishop: 1.08, rook: 0.95, queen: 1.18, king: 1.25 };
const ROTATION_Y: Record<PieceSet, number> = { light: Math.PI, dark: 0 };
const MOVE_DURATION: Record<PieceModelBase, number> = { pawn: 0.34, knight: 0.52, bishop: 0.46, rook: 0.42, queen: 0.5, king: 0.48 };

function applySkin(material: THREE.MeshStandardMaterial, set: PieceSet, skin: Chess3DPieceSkin) {
  const light = set === "light";
  switch (skin) {
    case "classic":
      // Explicit colours: tinting in linear space left "black" pieces mid-grey.
      material.color.set(light ? "#f2eee6" : "#1d1e23");
      material.roughness = light ? 0.32 : 0.36;
      material.metalness = light ? 0.05 : 0.3;
      break;
    case "gilded":
      material.color.set(light ? "#efe6d2" : "#23252b");
      material.roughness = light ? 0.26 : 0.22;
      material.metalness = light ? 0.35 : 0.8;
      material.emissive.set(light ? "#3a2a08" : "#2a1d05");
      material.emissiveIntensity = 0.35;
      break;
    case "marble":
      material.color.set(light ? "#f4efe6" : "#25332f");
      material.roughness = 0.58;
      material.metalness = 0.02;
      break;
    case "obsidian":
      material.color.set(light ? "#a8b2c0" : "#08090c");
      material.roughness = light ? 0.22 : 0.16;
      material.metalness = 0.7;
      material.emissive.set(light ? "#111827" : "#050208");
      material.emissiveIntensity = 0.04;
      break;
    case "neon":
      material.color.set(light ? "#dff7ff" : "#28183f");
      material.roughness = 0.22;
      material.metalness = 0.48;
      material.emissive.set(light ? "#0ea5e9" : "#9333ea");
      material.emissiveIntensity = 0.32;
      break;
  }
}

/** A GLTF piece, cloned once per model/skin (hover/selection never re-clone it). */
function LoadedModel({ base, set, skin, scale = 1 }: { base: PieceModelBase; set: PieceSet; skin: Chess3DPieceSkin; scale?: number }) {
  const { scene } = useGLTF(MODEL_PATHS[set][base]);

  const prepared = useMemo(() => {
    const model = scene.clone(true);
    const materials: THREE.Material[] = [];
    model.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = source.map((material) => {
        const next = material.clone();
        if (next instanceof THREE.MeshStandardMaterial) applySkin(next, set, skin);
        materials.push(next);
        return next;
      });
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const fit = (PIECE_HEIGHT[base] * scale) / Math.max(0.001, box.max.y - box.min.y);
    return { model, materials, fit, offset: [-center.x * fit, -box.min.y * fit, -center.z * fit] as [number, number, number] };
  }, [scene, set, skin, base, scale]);

  // The clone owns its materials; release them when the model or skin changes.
  useEffect(() => () => prepared.materials.forEach((material) => material.dispose()), [prepared]);

  return (
    <group rotation={[0, ROTATION_Y[set], 0]}>
      <primitive object={prepared.model} scale={prepared.fit} position={prepared.offset} />
    </group>
  );
}

/* ----------------------------------------------------------- Accents */

const ACCENT_GEOMETRY = {
  crownBand: new THREE.TorusGeometry(0.1, 0.022, 8, 24),
  crownPoint: new THREE.ConeGeometry(0.022, 0.07, 6),
  orb: new THREE.SphereGeometry(0.085, 24, 16),
  flame: new THREE.ConeGeometry(0.07, 0.24, 12),
  shield: new THREE.CylinderGeometry(0.15, 0.15, 0.03, 24),
  spike: new THREE.ConeGeometry(0.035, 0.16, 8),
};

function PieceAccent({ accent, tint = "#fbbf24", height, reducedMotion }: { accent: PieceModelAccent; tint?: string; height: number; reducedMotion?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: accent === "shield" ? 0.25 : 1.4, roughness: 0.25, metalness: 0.6, toneMapped: accent === "shield" }), [tint, accent]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group || reducedMotion) return;
    const t = state.clock.elapsedTime;
    if (accent === "orb") {
      group.position.y = height + 0.2 + Math.sin(t * 2.2) * 0.04;
      group.rotation.y = t * 0.8;
    } else if (accent === "flame") {
      group.scale.set(1, 1 + Math.sin(t * 11) * 0.12, 1);
    } else if (accent === "crown" || accent === "spike") {
      group.rotation.y = t * 0.35;
    }
  });

  switch (accent) {
    case "crown":
      return (
        <group ref={groupRef} position={[0, height + 0.02, 0]}>
          <mesh geometry={ACCENT_GEOMETRY.crownBand} material={material} rotation={[Math.PI / 2, 0, 0]} />
          {Array.from({ length: 5 }, (_, index) => {
            const angle = (index / 5) * Math.PI * 2;
            return <mesh key={index} geometry={ACCENT_GEOMETRY.crownPoint} material={material} position={[Math.cos(angle) * 0.1, 0.045, Math.sin(angle) * 0.1]} />;
          })}
        </group>
      );
    case "orb":
      return (
        <group ref={groupRef} position={[0, height + 0.2, 0]}>
          <mesh geometry={ACCENT_GEOMETRY.orb} material={material} />
        </group>
      );
    case "flame":
      return (
        <group ref={groupRef} position={[0, height + 0.1, 0]}>
          <mesh geometry={ACCENT_GEOMETRY.flame} material={material} />
        </group>
      );
    case "shield":
      return (
        <group ref={groupRef} position={[0.2, height * 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh geometry={ACCENT_GEOMETRY.shield} material={material} castShadow />
        </group>
      );
    case "spike":
      return (
        <group ref={groupRef} position={[0, height, 0]}>
          {Array.from({ length: 3 }, (_, index) => {
            const angle = (index / 3) * Math.PI * 2;
            return <mesh key={index} geometry={ACCENT_GEOMETRY.spike} material={material} position={[Math.cos(angle) * 0.07, 0.05, Math.sin(angle) * 0.07]} rotation={[Math.sin(angle) * 0.5, 0, -Math.cos(angle) * 0.5]} />;
          })}
        </group>
      );
    default:
      return null;
  }
}

/** A standalone model with its accent — for previews such as the piece inspector. */
export function PieceModelView({ base, set, skin, accent = "none", tint, scale = 1 }: { base: PieceModelBase; set: PieceSet; skin: Chess3DPieceSkin; accent?: PieceModelAccent; tint?: string; scale?: number }) {
  return (
    <group>
      <LoadedModel base={base} set={set} skin={skin} scale={scale} />
      {accent !== "none" && <PieceAccent accent={accent} tint={tint} height={PIECE_HEIGHT[base] * scale} />}
    </group>
  );
}

/* ----------------------------------------------------------- Capture */

const FRAGMENT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const FRAGMENTS = Array.from({ length: 11 }, (_, index) => {
  const angle = (index / 11) * Math.PI * 2;
  return {
    position: [Math.cos(angle) * (0.05 + (index % 3) * 0.045), 0.28 + (index % 5) * 0.09, Math.sin(angle) * (0.05 + (index % 3) * 0.045)] as const,
    velocity: [Math.cos(angle) * (0.8 + (index % 4) * 0.16), 0.22 + (index % 4) * 0.055 + (index % 2) * 0.16, Math.sin(angle) * (0.8 + ((index + 2) % 4) * 0.16)] as const,
    spin: [2.5 + (index % 3), 3 + ((index + 1) % 4), 2 + ((index + 2) % 5)] as const,
    size: 0.055 + (index % 3) * 0.018,
  };
});

/** Mounted only while a piece is being captured. */
function ShatterFragments({ set, skin }: { set: PieceSet; skin: Chess3DPieceSkin }) {
  const groupRef = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const color = skin === "neon" ? (set === "light" ? "#38bdf8" : "#a855f7") : set === "light" ? "#e5e7eb" : "#2b2d31";
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 }), [color]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    progress.current = Math.min(1, progress.current + delta / 0.55);
    const t = progress.current;
    group.children.forEach((child, index) => {
      const spec = FRAGMENTS[index];
      child.position.set(spec.position[0] + spec.velocity[0] * t, spec.position[1] + spec.velocity[1] * t - 1.9 * t * t, spec.position[2] + spec.velocity[2] * t);
      child.rotation.set(spec.spin[0] * t, spec.spin[1] * t, spec.spin[2] * t);
      child.scale.setScalar(Math.max(0.001, 1 - t) * spec.size);
    });
  });

  return (
    <group ref={groupRef}>
      {FRAGMENTS.map((spec, index) => (
        <mesh key={index} geometry={FRAGMENT_GEOMETRY} material={material} position={spec.position} scale={spec.size} castShadow />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- Piece */

function ChessPiece3D({
  x,
  y,
  boardWidth,
  boardHeight,
  base,
  set,
  skin,
  accent = "none",
  tint,
  scale = 1,
  selected,
  captured,
  promotedKey = 0,
  inCheck,
  checkmated,
  motion = "slide",
  teamColor,
  reducedMotion = false,
  onClick,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const initialized = useRef(false);
  const move = useRef({ progress: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), motion: "slide" as PieceMotion });
  const capture = useRef(0);
  const promotion = useRef(1);
  const pulse = useRef(0);
  const [wx, , wz] = cellToWorld(x, y, boardWidth, boardHeight);
  const height = PIECE_HEIGHT[base] * scale;

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const target = new THREE.Vector3(wx, 0.08, wz);
    if (!initialized.current || reducedMotion || motion === "instant") {
      group.position.copy(target);
      move.current.progress = 1;
      initialized.current = true;
      return;
    }
    move.current = { progress: 0, from: group.position.clone(), to: target, motion };
    // Motion is read when the square changes; later motion-only changes do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wx, wz]);

  useEffect(() => {
    if (promotedKey > 0 && !reducedMotion) promotion.current = 0;
  }, [promotedKey, reducedMotion]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) return;

    const travel = move.current;
    if (travel.progress < 1) {
      const duration = travel.motion === "teleport" ? 0.5 : MOVE_DURATION[base];
      travel.progress = Math.min(1, travel.progress + delta / duration);
      const t = travel.progress;
      if (travel.motion === "teleport") {
        // Shrink out at the origin, reappear at the destination.
        const out = t < 0.5;
        group.position.copy(out ? travel.from : travel.to);
        body.scale.setScalar(Math.max(0.001, out ? 1 - t * 2 : (t - 0.5) * 2));
        body.rotation.y = (out ? t : 1 - t) * Math.PI * 2;
      } else {
        const eased = 1 - Math.pow(1 - t, 3);
        group.position.lerpVectors(travel.from, travel.to, eased);
        const jump = travel.motion === "jump" || base === "knight";
        const arc = Math.sin(t * Math.PI) * (jump ? 0.78 : base === "pawn" ? 0.17 : base === "queen" ? 0.15 : 0.08);
        group.position.y = 0.08 + arc;
        body.rotation.z = jump ? Math.sin(t * Math.PI) * 0.18 * (set === "light" ? -1 : 1) : 0;
      }
      if (t >= 1) {
        group.position.copy(travel.to);
        body.rotation.set(0, 0, 0);
        body.scale.setScalar(1);
      }
      return;
    }

    if (captured) {
      capture.current = Math.min(1, capture.current + delta / 0.28);
      const t = capture.current;
      body.position.y = Math.sin(t * Math.PI) * 0.12;
      body.rotation.z = (set === "light" ? -1 : 1) * t * 0.9;
      body.scale.setScalar(Math.max(0.001, 1 - t * 1.8));
      body.visible = t < 0.62;
      return;
    }

    if (promotion.current < 1) {
      promotion.current = Math.min(1, promotion.current + delta / 0.6);
      const t = promotion.current;
      const eased = 1 - Math.pow(1 - t, 3);
      body.position.y = THREE.MathUtils.lerp(-0.35, 0, eased) + Math.sin(t * Math.PI) * 0.1;
      body.scale.setScalar(THREE.MathUtils.lerp(0.72, 1, eased));
      return;
    }

    if (checkmated) {
      pulse.current = Math.min(1, pulse.current + delta / 1.15);
      body.rotation.z = (set === "light" ? -1 : 1) * pulse.current;
      body.position.y = -0.08 * pulse.current;
      return;
    }

    if (inCheck && !reducedMotion) {
      pulse.current += delta;
      body.scale.setScalar(1 + Math.sin(pulse.current * 16) * 0.035);
      body.rotation.z = Math.sin(pulse.current * 32) * 0.045;
      return;
    }

    pulse.current = 0;
    const smoothing = 1 - Math.exp(-12 * delta);
    const breathe = !reducedMotion && (base === "king" || base === "queen") ? Math.sin(state.clock.elapsedTime * 2.2) * 0.008 : 0;
    body.position.y = THREE.MathUtils.lerp(body.position.y, (hovered ? 0.085 : 0) + (selected ? 0.05 : 0) + breathe, smoothing);
    body.scale.setScalar(THREE.MathUtils.lerp(body.scale.x, hovered ? 1.045 : selected ? 1.025 : 1, smoothing));
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, 0, smoothing);
  });

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (!captured) onClick(x, y);
  }

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerEnter={(event) => {
        event.stopPropagation();
        if (captured) return;
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      {(inCheck || checkmated) && (
        <>
          <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.34, 0.5, 48]} />
            <meshBasicMaterial color={checkmated ? "#fb7185" : "#ef4444"} transparent opacity={checkmated ? 0.82 : 0.62} depthWrite={false} />
          </mesh>
          <pointLight position={[0, 0.65, 0]} color={checkmated ? "#fb7185" : "#ef4444"} intensity={checkmated ? 3.2 : 2.1} distance={2.2} />
        </>
      )}
      {teamColor && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4, 40]} />
          <meshBasicMaterial color={teamColor} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {selected && <pointLight position={[0.3, height + 0.5, 0.3]} color="#fbbf24" intensity={2.4} distance={2.4} />}
      <group ref={bodyRef}>
        <LoadedModel base={base} set={set} skin={skin} scale={scale} />
        {accent !== "none" && <PieceAccent accent={accent} tint={tint} height={height} reducedMotion={reducedMotion} />}
      </group>
      {captured && <ShatterFragments set={set} skin={skin} />}
    </group>
  );
}

export default memo(ChessPiece3D);

Object.values(MODEL_PATHS).forEach((paths) => Object.values(paths).forEach((path) => useGLTF.preload(path)));
