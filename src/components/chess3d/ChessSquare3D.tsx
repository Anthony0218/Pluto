import { memo, useMemo, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { BoardCell } from "@/games/chess/custom/engine/types";
import { cellToWorld } from "@/games/chess/3d/chess3dUtils";
import { GEOMETRY, MARK_MATERIALS, TILE_MATERIALS, standardMaterial } from "./sharedResources";

export type Square3DMark = "selected" | "move" | "capture" | "special" | "lastFrom" | "lastTo" | "check" | "target" | "illegal";

export interface Square3DPalette {
  light: string;
  dark: string;
  roughness: number;
  metalness: number;
}

type Props = {
  cell: BoardCell;
  width: number;
  height: number;
  palette: Square3DPalette;
  mark?: Square3DMark;
  onClick: (x: number, y: number) => void;
};

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

function Marker({ mark }: { mark: Square3DMark }) {
  switch (mark) {
    case "move":
      return (
        <>
          <mesh geometry={GEOMETRY.glow} material={MARK_MATERIALS.moveGlow} rotation={FLAT} position={[0, 0.082, 0]} />
          <mesh geometry={GEOMETRY.disc} material={MARK_MATERIALS.moveCore} rotation={FLAT} position={[0, 0.084, 0]} />
        </>
      );
    case "capture":
      return (
        <>
          <mesh geometry={GEOMETRY.glow} material={MARK_MATERIALS.captureGlow} rotation={FLAT} position={[0, 0.082, 0]} />
          <mesh geometry={GEOMETRY.ring} material={MARK_MATERIALS.captureRing} rotation={FLAT} position={[0, 0.084, 0]} />
        </>
      );
    case "special":
      return (
        <>
          <mesh geometry={GEOMETRY.glow} material={MARK_MATERIALS.specialGlow} rotation={FLAT} position={[0, 0.082, 0]} />
          <mesh geometry={GEOMETRY.diamond} material={MARK_MATERIALS.special} rotation={FLAT} position={[0, 0.084, 0]} />
        </>
      );
    case "selected":
      return <mesh geometry={GEOMETRY.frame} material={MARK_MATERIALS.selected} rotation={FLAT} position={[0, 0.083, 0]} scale={0.74} />;
    case "target":
      return <mesh geometry={GEOMETRY.frame} material={MARK_MATERIALS.target} rotation={FLAT} position={[0, 0.083, 0]} scale={0.74} />;
    case "lastFrom":
      return <mesh geometry={GEOMETRY.plane} material={MARK_MATERIALS.lastFrom} rotation={FLAT} position={[0, 0.079, 0]} />;
    case "lastTo":
      return <mesh geometry={GEOMETRY.plane} material={MARK_MATERIALS.lastTo} rotation={FLAT} position={[0, 0.079, 0]} />;
    case "illegal":
      return <mesh geometry={GEOMETRY.disc} material={MARK_MATERIALS.illegal} rotation={FLAT} position={[0, 0.083, 0]} scale={0.55} />;
    case "check":
      return <mesh geometry={GEOMETRY.glow} material={MARK_MATERIALS.check} rotation={FLAT} position={[0, 0.082, 0]} scale={1.15} />;
    default:
      return null;
  }
}

function TileDecoration({ cell }: { cell: BoardCell }) {
  switch (cell.tile) {
    case "blocked":
      return <mesh geometry={GEOMETRY.blockedCap} material={TILE_MATERIALS.blocked} position={[0, 0.24, 0]} castShadow receiveShadow />;
    case "portal":
      return (
        <>
          <mesh geometry={GEOMETRY.portalRing} material={TILE_MATERIALS.portalRing} rotation={FLAT} position={[0, 0.09, 0]} />
          <mesh geometry={GEOMETRY.portalCore} material={TILE_MATERIALS.portalCore} rotation={FLAT} position={[0, 0.081, 0]} />
        </>
      );
    case "promotion":
      return <mesh geometry={GEOMETRY.promotionFrame} material={TILE_MATERIALS.promotion} rotation={FLAT} position={[0, 0.08, 0]} />;
    case "goal":
      return <mesh geometry={GEOMETRY.goalGem} material={TILE_MATERIALS.goal} position={[0.32, 0.2, -0.32]} />;
    case "spawn":
      return <mesh geometry={GEOMETRY.ring} material={TILE_MATERIALS.spawn} rotation={FLAT} position={[0, 0.08, 0]} scale={0.82} />;
    case "danger":
      return <mesh geometry={GEOMETRY.plane} material={TILE_MATERIALS.danger} rotation={FLAT} position={[0, 0.08, 0]} />;
    case "ice":
      return <mesh geometry={GEOMETRY.plane} material={TILE_MATERIALS.ice} rotation={FLAT} position={[0, 0.079, 0]} />;
    case "teleport":
      return (
        <>
          <mesh geometry={GEOMETRY.ring} material={TILE_MATERIALS.teleport} rotation={FLAT} position={[0, 0.08, 0]} scale={0.9} />
          <mesh geometry={GEOMETRY.ring} material={TILE_MATERIALS.teleport} rotation={FLAT} position={[0, 0.08, 0]} scale={0.5} />
        </>
      );
    case "oneWay": {
      const direction = cell.direction ?? { x: 0, y: 1 };
      // Board +x is world +z and board +y is world -x; the cone points +z before yaw.
      const yaw = Math.atan2(-direction.y, direction.x);
      return (
        <group rotation={[0, yaw, 0]} position={[0, 0.11, 0]}>
          <mesh geometry={GEOMETRY.arrow} material={TILE_MATERIALS.oneWay} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.35]} />
        </group>
      );
    }
    default:
      return null;
  }
}

/** One board cell. Disabled cells render as a recessed void inside the frame. */
function ChessSquare3D({ cell, width, height, palette, mark, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const [wx, , wz] = cellToWorld(cell.x, cell.y, width, height);
  const light = (cell.x + cell.y) % 2 === 1;
  const material = useMemo(() => {
    const base = new THREE.Color(light ? palette.light : palette.dark);
    if (hovered) base.offsetHSL(0, 0, light ? 0.05 : 0.07);
    return standardMaterial(`#${base.getHexString()}`, palette.roughness, palette.metalness);
  }, [light, hovered, palette]);

  if (!cell.enabled) {
    return <mesh geometry={GEOMETRY.hole} material={TILE_MATERIALS.hole} position={[wx, -0.06, wz]} receiveShadow />;
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onClick(cell.x, cell.y);
  }

  return (
    <group position={[wx, 0, wz]}>
      <mesh
        geometry={GEOMETRY.square}
        material={material}
        position={[0, hovered ? 0.012 : 0, 0]}
        receiveShadow
        onClick={handleClick}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      />
      <TileDecoration cell={cell} />
      {mark && <Marker mark={mark} />}
    </group>
  );
}

export default memo(ChessSquare3D);
