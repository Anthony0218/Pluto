import { useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Square } from "chess.js";

type Props = {
  square: Square;
  file: number;
  rank: number;
  selected: boolean;
  legalMove: boolean;
  legalCapture: boolean;
  lastMoveFrom?: boolean;
  lastMoveTo?: boolean;
  onClick: (square: Square) => void;
};

function isLightSquare(square: Square) {
  const fileIndex = square.charCodeAt(0) - "a".charCodeAt(0);
  const rankNumber = Number(square[1]);
  return (fileIndex + rankNumber) % 2 === 0;
}

export default function ChessSquare3D({
  square,
  file,
  rank,
  selected,
  legalMove,
  legalCapture,
  lastMoveFrom = false,
  lastMoveTo = false,
  onClick,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const isLight = isLightSquare(square);

  let color = isLight ? "#33251f" : "#d8d3c8";

  if (selected) {
    color = "#38bdf8";
  } else if (legalCapture) {
    color = "#dc2626";
  } else if (legalMove) {
    color = "#22c55e";
  } else if (lastMoveTo) {
    color = "#d97706";
  } else if (lastMoveFrom) {
    color = "#a16207";
  } else if (hovered) {
    color = isLight ? "#4b3830" : "#eee9dd";
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onClick(square);
  }

  const x = 3.5 - rank;
  const z = file - 3.5;

  return (
    <group>
      <mesh
        position={[x, hovered ? 0.018 : 0, z]}
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
      >
        <boxGeometry args={[1, 0.15, 1]} />
        <meshStandardMaterial
          color={color}
          roughness={hovered ? 0.38 : 0.55}
          metalness={hovered ? 0.08 : 0.02}
        />
      </mesh>

      {(lastMoveFrom || lastMoveTo) && !selected && !legalMove && (
        <mesh position={[x, 0.09, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.34, 0.43, 32]} />
          <meshBasicMaterial
            color={lastMoveTo ? "#fbbf24" : "#f59e0b"}
            transparent
            opacity={lastMoveTo ? 0.66 : 0.42}
            depthWrite={false}
          />
        </mesh>
      )}

      {legalMove && (
        <mesh
          position={[x, 0.095, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={handleClick}
        >
          <circleGeometry args={[legalCapture ? 0.38 : 0.16, 32]} />
          <meshBasicMaterial
            color={legalCapture ? "#ef4444" : "#166534"}
            transparent
            opacity={0.78}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
