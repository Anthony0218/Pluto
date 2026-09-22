import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Color, PieceSymbol, Square } from "chess.js";

import { squareToWorld } from "../../games/chess/3d/chess3dUtils";
import type { Chess3DPieceSkin } from "../../games/chess/3d/chess3dAppearance";

type Props = {
  square: Square;
  type: PieceSymbol;
  color: Color;
  selected: boolean;
  captured: boolean;
  promoted: boolean;
  inCheck: boolean;
  checkmated: boolean;
  skin: Chess3DPieceSkin;
  onClick: (square: Square) => void;
};

const modelPaths: Record<Color, Record<PieceSymbol, string>> = {
  w: {
    p: "/models/chess/white/pawn.glb",
    n: "/models/chess/white/knight.glb",
    b: "/models/chess/white/bishop.glb",
    r: "/models/chess/white/rook.glb",
    q: "/models/chess/white/queen.glb",
    k: "/models/chess/white/king.glb",
  },
  b: {
    p: "/models/chess/black/pawn.glb",
    n: "/models/chess/black/knight.glb",
    b: "/models/chess/black/bishop.glb",
    r: "/models/chess/black/rook.glb",
    q: "/models/chess/black/queen.glb",
    k: "/models/chess/black/king.glb",
  },
};

const targetHeight: Record<PieceSymbol, number> = {
  p: 0.78,
  n: 1.02,
  b: 1.08,
  r: 0.95,
  q: 1.18,
  k: 1.25,
};

const pieceRotationY: Record<Color, number> = {
  w: Math.PI,
  b: 0,
};

const moveDuration: Record<PieceSymbol, number> = {
  p: 0.34,
  n: 0.52,
  b: 0.46,
  r: 0.42,
  q: 0.5,
  k: 0.48,
};

type FragmentSpec = {
  position: [number, number, number];
  velocity: [number, number, number];
  rotationSpeed: [number, number, number];
  size: number;
};

function createFragments(type: PieceSymbol): FragmentSpec[] {
  const count = type === "p" ? 9 : 13;

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const ring = 0.05 + (index % 3) * 0.045;
    const lift = 0.22 + (index % 4) * 0.055;

    return {
      position: [
        Math.cos(angle) * ring,
        0.28 + (index % 5) * 0.09,
        Math.sin(angle) * ring,
      ],
      velocity: [
        Math.cos(angle) * (0.8 + (index % 4) * 0.16),
        lift + (index % 2) * 0.16,
        Math.sin(angle) * (0.8 + ((index + 2) % 4) * 0.16),
      ],
      rotationSpeed: [
        2.5 + (index % 3),
        3.0 + ((index + 1) % 4),
        2.0 + ((index + 2) % 5),
      ],
      size: 0.055 + (index % 3) * 0.018,
    };
  });
}

function skinMaterial(
  material: THREE.MeshStandardMaterial,
  color: Color,
  skin: Chess3DPieceSkin,
  selected: boolean,
  hovered: boolean,
) {
  const next = material;
  const accent = color === "w" ? "#7dd3fc" : "#c084fc";

  if (skin === "classic") {
    const originalColor = next.color.clone();
    const teamTint =
      color === "w" ? new THREE.Color("#f8fafc") : new THREE.Color("#111318");

    next.color.copy(originalColor).lerp(teamTint, 0.7);
    next.roughness = color === "w" ? 0.32 : 0.48;
    next.metalness = color === "w" ? 0.05 : 0.22;
    next.emissive.set(selected || hovered ? accent : "#000000");
    next.emissiveIntensity = selected ? 0.28 : hovered ? 0.12 : 0;
    return;
  }

  if (skin === "marble") {
    next.color.set(color === "w" ? "#f4efe6" : "#25332f");
    next.roughness = 0.58;
    next.metalness = 0.02;
    next.emissive.set(selected || hovered ? accent : "#000000");
    next.emissiveIntensity = selected ? 0.24 : hovered ? 0.1 : 0;
    return;
  }

  if (skin === "obsidian") {
    next.color.set(color === "w" ? "#a8b2c0" : "#08090c");
    next.roughness = color === "w" ? 0.22 : 0.16;
    next.metalness = 0.7;
    next.emissive.set(
      selected || hovered ? accent : color === "w" ? "#111827" : "#050208",
    );
    next.emissiveIntensity = selected ? 0.34 : hovered ? 0.16 : 0.04;
    return;
  }

  next.color.set(color === "w" ? "#dff7ff" : "#28183f");
  next.roughness = 0.22;
  next.metalness = 0.48;
  next.emissive.set(color === "w" ? "#0ea5e9" : "#9333ea");
  next.emissiveIntensity = selected ? 0.72 : hovered ? 0.52 : 0.32;
}

function ShatterFragments({
  active,
  color,
  type,
  skin,
}: {
  active: boolean;
  color: Color;
  type: PieceSymbol;
  skin: Chess3DPieceSkin;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const specs = useMemo(() => createFragments(type), [type]);

  useEffect(() => {
    if (!active) {
      progressRef.current = 0;

      if (groupRef.current) {
        groupRef.current.children.forEach((child, index) => {
          const spec = specs[index];
          if (!spec) return;
          child.position.set(...spec.position);
          child.rotation.set(0, 0, 0);
          child.scale.setScalar(1);
        });
      }
    }
  }, [active, specs]);

  useFrame((_, delta) => {
    if (!active || !groupRef.current) return;

    progressRef.current = Math.min(1, progressRef.current + delta / 0.55);
    const t = progressRef.current;

    groupRef.current.children.forEach((child, index) => {
      const spec = specs[index];
      if (!spec) return;

      const gravity = 1.9 * t * t;

      child.position.set(
        spec.position[0] + spec.velocity[0] * t,
        spec.position[1] + spec.velocity[1] * t - gravity,
        spec.position[2] + spec.velocity[2] * t,
      );

      child.rotation.x = spec.rotationSpeed[0] * t;
      child.rotation.y = spec.rotationSpeed[1] * t;
      child.rotation.z = spec.rotationSpeed[2] * t;
      child.scale.setScalar(Math.max(0.001, 1 - t));
    });
  });

  const fragmentColor =
    skin === "neon"
      ? color === "w"
        ? "#38bdf8"
        : "#a855f7"
      : color === "w"
        ? "#e5e7eb"
        : "#2b2d31";

  return (
    <group ref={groupRef} visible={active}>
      {specs.map((spec, index) => (
        <mesh key={index} position={spec.position} castShadow>
          <boxGeometry args={[spec.size, spec.size, spec.size]} />
          <meshStandardMaterial
            color={fragmentColor}
            roughness={skin === "obsidian" ? 0.18 : 0.5}
            metalness={skin === "obsidian" ? 0.7 : 0.16}
            emissive={skin === "neon" ? fragmentColor : "#000000"}
            emissiveIntensity={skin === "neon" ? 0.5 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}

function LoadedModel({
  type,
  color,
  selected,
  hovered,
  skin,
}: {
  type: PieceSymbol;
  color: Color;
  selected: boolean;
  hovered: boolean;
  skin: Chess3DPieceSkin;
}) {
  const { scene } = useGLTF(modelPaths[color][type]);

  const prepared = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((object) => {
      if (!("isMesh" in object) || !object.isMesh) return;

      const mesh = object as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const sourceMaterials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      const clonedMaterials = sourceMaterials.map((material) => {
        const next = material.clone();

        if (next instanceof THREE.MeshStandardMaterial) {
          skinMaterial(next, color, skin, selected, hovered);
        }

        return next;
      });

      mesh.material = Array.isArray(mesh.material)
        ? clonedMaterials
        : clonedMaterials[0];
    });

    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const height = Math.max(0.001, box.max.y - box.min.y);
    const scale = targetHeight[type] / height;

    const position = new THREE.Vector3(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    );

    return { model: cloned, scale, position };
  }, [scene, selected, hovered, type, color, skin]);

  return (
    <group rotation={[0, pieceRotationY[color], 0]}>
      <primitive
        object={prepared.model}
        scale={prepared.scale}
        position={[
          prepared.position.x,
          prepared.position.y,
          prepared.position.z,
        ]}
      />
    </group>
  );
}

export default function ChessPiece3D({
  square,
  type,
  color,
  selected,
  captured,
  promoted,
  inCheck,
  checkmated,
  skin,
  onClick,
}: Props) {
  const [hovered, setHovered] = useState(false);

  const groupRef = useRef<THREE.Group>(null);
  const modelWrapperRef = useRef<THREE.Group>(null);
  const initializedRef = useRef(false);
  const captureProgressRef = useRef(0);
  const promotionProgressRef = useRef(0);
  const checkTimeRef = useRef(0);

  const moveProgressRef = useRef(1);
  const moveStartRef = useRef(new THREE.Vector3());
  const moveTargetRef = useRef(new THREE.Vector3());

  const [targetX, , targetZ] = squareToWorld(square);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const nextTarget = new THREE.Vector3(targetX, 0.08, targetZ);

    if (!initializedRef.current) {
      group.position.copy(nextTarget);
      moveTargetRef.current.copy(nextTarget);
      initializedRef.current = true;
      return;
    }

    moveStartRef.current.copy(group.position);
    moveTargetRef.current.copy(nextTarget);
    moveProgressRef.current = 0;
  }, [targetX, targetZ]);

  useEffect(() => {
    if (!captured) {
      captureProgressRef.current = 0;

      if (modelWrapperRef.current) {
        modelWrapperRef.current.visible = true;
        modelWrapperRef.current.scale.setScalar(1);
        modelWrapperRef.current.rotation.set(0, 0, 0);
        modelWrapperRef.current.position.set(0, 0, 0);
      }
    }
  }, [captured]);

  useEffect(() => {
    if (!promoted || !modelWrapperRef.current) return;

    promotionProgressRef.current = 0;
    modelWrapperRef.current.position.y = -0.35;
    modelWrapperRef.current.scale.setScalar(0.72);
  }, [promoted]);

  useEffect(() => {
    if (
      !inCheck &&
      !checkmated &&
      modelWrapperRef.current &&
      !captured &&
      !promoted
    ) {
      checkTimeRef.current = 0;
      modelWrapperRef.current.rotation.x = 0;
      modelWrapperRef.current.rotation.z = 0;
      modelWrapperRef.current.position.y = 0;
      modelWrapperRef.current.scale.setScalar(1);
    }
  }, [inCheck, checkmated, captured, promoted]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const modelWrapper = modelWrapperRef.current;

    if (!group || !modelWrapper) return;

    if (moveProgressRef.current < 1) {
      moveProgressRef.current = Math.min(
        1,
        moveProgressRef.current + delta / moveDuration[type],
      );

      const t = moveProgressRef.current;
      const eased = 1 - Math.pow(1 - t, 3);

      group.position.lerpVectors(
        moveStartRef.current,
        moveTargetRef.current,
        eased,
      );

      let arc = 0;
      let leanX = 0;
      let leanZ = 0;

      if (type === "n") {
        arc = Math.sin(t * Math.PI) * 0.78;
        leanZ = Math.sin(t * Math.PI) * 0.18 * (color === "w" ? -1 : 1);
      } else if (type === "p") {
        arc = Math.sin(t * Math.PI) * 0.17;
      } else if (type === "b") {
        arc = Math.sin(t * Math.PI) * 0.08;
        leanX = Math.sin(t * Math.PI) * 0.12;
      } else if (type === "r") {
        arc = Math.sin(t * Math.PI) * 0.045;
        modelWrapper.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.035);
      } else if (type === "q") {
        arc = Math.sin(t * Math.PI) * 0.15;
        modelWrapper.rotation.y = Math.sin(t * Math.PI) * 0.08;
      } else if (type === "k") {
        arc = Math.sin(t * Math.PI) * 0.09;
        modelWrapper.rotation.y = Math.sin(t * Math.PI * 2) * 0.045;
      }

      group.position.y = 0.08 + arc;
      modelWrapper.rotation.x = leanX;
      modelWrapper.rotation.z = leanZ;

      if (t >= 1) {
        group.position.copy(moveTargetRef.current);
        modelWrapper.rotation.x = 0;
        modelWrapper.rotation.y = 0;
        modelWrapper.rotation.z = 0;
        modelWrapper.scale.setScalar(1);
      }
    }

    if (captured) {
      captureProgressRef.current = Math.min(
        1,
        captureProgressRef.current + delta / 0.28,
      );

      const t = captureProgressRef.current;
      const pop = Math.sin(Math.min(1, t) * Math.PI) * 0.12;
      const shrink = Math.max(0.001, 1 - t * 1.8);

      modelWrapper.position.y = pop;
      modelWrapper.rotation.z = (color === "w" ? -1 : 1) * t * 0.9;
      modelWrapper.scale.setScalar(shrink);

      if (t > 0.62) {
        modelWrapper.visible = false;
      }

      return;
    }

    if (promoted && promotionProgressRef.current < 1) {
      promotionProgressRef.current = Math.min(
        1,
        promotionProgressRef.current + delta / 0.6,
      );

      const t = promotionProgressRef.current;
      const eased = 1 - Math.pow(1 - t, 3);

      modelWrapper.position.y =
        THREE.MathUtils.lerp(-0.35, 0, eased) + Math.sin(t * Math.PI) * 0.1;

      modelWrapper.scale.setScalar(THREE.MathUtils.lerp(0.72, 1, eased));
    }

    if (checkmated) {
      checkTimeRef.current += delta;

      const t = Math.min(1, checkTimeRef.current / 1.15);
      const fallDirection = color === "w" ? -1 : 1;

      modelWrapper.rotation.z = fallDirection * t * 1.0;
      modelWrapper.position.y = -0.08 * t;
      modelWrapper.scale.setScalar(1 - 0.08 * t);
      return;
    }

    if (inCheck) {
      checkTimeRef.current += delta;

      const pulse = 1 + Math.sin(checkTimeRef.current * 16) * 0.035;
      const shake = Math.sin(checkTimeRef.current * 32) * 0.045;

      modelWrapper.scale.setScalar(pulse);
      modelWrapper.rotation.z = shake;
      modelWrapper.position.y =
        Math.abs(Math.sin(checkTimeRef.current * 10)) * 0.025;
    } else if (!promoted && moveProgressRef.current >= 1) {
      const hoverLift = hovered ? 0.085 : 0;
      const selectionLift = selected ? 0.045 : 0;
      const breathe =
        type === "q" || type === "k"
          ? Math.sin(state.clock.elapsedTime * 2.2) * 0.008
          : 0;

      modelWrapper.position.y = THREE.MathUtils.lerp(
        modelWrapper.position.y,
        hoverLift + selectionLift + breathe,
        1 - Math.exp(-12 * delta),
      );

      const targetScale = hovered ? 1.045 : selected ? 1.025 : 1;
      const currentScale = modelWrapper.scale.x;
      modelWrapper.scale.setScalar(
        THREE.MathUtils.lerp(
          currentScale,
          targetScale,
          1 - Math.exp(-12 * delta),
        ),
      );
    }
  });

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();

    if (!captured) {
      onClick(square);
    }
  }

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerEnter={(event) => {
        event.stopPropagation();
        if (!captured) {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }
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
            <meshBasicMaterial
              color={checkmated ? "#fb7185" : "#ef4444"}
              transparent
              opacity={checkmated ? 0.82 : 0.62}
              depthWrite={false}
            />
          </mesh>

          <pointLight
            position={[0, 0.65, 0]}
            color={checkmated ? "#fb7185" : "#ef4444"}
            intensity={checkmated ? 3.2 : 2.1}
            distance={2.2}
          />
        </>
      )}

      <group ref={modelWrapperRef}>
        <LoadedModel
          type={type}
          color={color}
          selected={selected}
          hovered={hovered}
          skin={skin}
        />
      </group>

      <ShatterFragments
        active={captured}
        color={color}
        type={type}
        skin={skin}
      />
    </group>
  );
}

Object.values(modelPaths.w).forEach((path) => useGLTF.preload(path));
Object.values(modelPaths.b).forEach((path) => useGLTF.preload(path));
