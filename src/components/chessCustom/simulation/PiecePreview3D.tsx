import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import type * as THREE from "three";
import { PieceModelView } from "@/components/chess3d/ChessPiece3D";
import type { Chess3DPieceSkin } from "@/games/chess/3d/chess3dAppearance";
import type { PieceDefinition } from "@/games/chess/custom/engine/types";

function Turntable({ def, set, skin, reducedMotion }: { def: PieceDefinition; set: "light" | "dark"; skin: Chess3DPieceSkin; reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current && !reducedMotion) ref.current.rotation.y += delta * 0.6;
  });
  return (
    <group ref={ref} position={[0, -0.6, 0]}>
      <PieceModelView base={def.model.base} set={set} skin={skin} accent={def.model.accent} tint={def.model.tint} scale={def.model.scale} />
    </group>
  );
}

export default function PiecePreview3D({ def, set, skin, reducedMotion }: { def: PieceDefinition; set: "light" | "dark"; skin: Chess3DPieceSkin; reducedMotion: boolean }) {
  return (
    <div className="h-36 overflow-hidden rounded-xl border border-white/[0.08] bg-[radial-gradient(circle_at_50%_40%,rgba(251,191,36,.12),transparent_65%)]">
      <Canvas dpr={[1, 1.5]} camera={{ position: [1.9, 1.1, 1.9], fov: 32 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 2]} intensity={2.2} color="#fff4db" />
        <directionalLight position={[-3, 1, -2]} intensity={1.2} color="#7dd3fc" />
        <Suspense fallback={null}>
          <Turntable def={def} set={set} skin={skin} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}

