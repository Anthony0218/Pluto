import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { DoubleSide } from "three";
import { DEFAULT_OUTER_RADIUS_M, EXTRACTION_RATE_M3, TOTAL_DIVIDENDS, type DividendId } from "@/games/chess/janmann/config";
import { measureVolume } from "@/games/chess/janmann/volume";
import { NODES } from "@/games/chess/janmann/topology";
import { ui } from "@/i18n/ui";
import { SceneBoundary } from "./JanmannBoard";

const steps = ["Outer volume", "Subtract inner volume", "Subtract angular volume", "Resulting volume"];

export default function VolumeMeasurement({ selected, remaining, animationKey }: { selected: DividendId; remaining: number; animationKey: number }) {
  const [measurementT, setMeasurementT] = useState(.45);
  const [stage, setStage] = useState(0);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    let step = 0;
    const start = window.setTimeout(() => setStage(0), 0);
    const timer = window.setInterval(() => {
      step += 1;
      setStage(Math.min(step, 3));
      if (step >= 3) window.clearInterval(timer);
    }, 1000);
    return () => { window.clearTimeout(start); window.clearInterval(timer); };
  }, [animationKey, replay]);
  const innerRadius = DEFAULT_OUTER_RADIUS_M * measurementT;
  const solidAngle = 4 * Math.PI / TOTAL_DIVIDENDS;
  const volume = measureVolume(DEFAULT_OUTER_RADIUS_M, innerRadius, solidAngle);
  const node = NODES[selected];
  const phi = solidAngle / 2;
  return <section className="rounded-2xl border border-amber-200/20 bg-[#181c25] p-4" aria-label={ui("Volume measurement")}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-serif text-lg text-amber-100">{ui("Measure")} · S{node.sectorId + 1} / D{node.dividendIndex + 1}</h2>
      <button className="text-xs text-amber-200 underline" onClick={() => setReplay((value) => value + 1)}>{ui("Replay calculation")}</button>
    </div>
    <p className="mt-1 text-xs leading-5 text-zinc-400">{ui("Measurement changes no pieces, turns or resources.")}</p>
    <div className="mt-3 h-44 overflow-hidden rounded-xl bg-[#10141d]" aria-label={ui(steps[stage])}>
      <SceneBoundary><Canvas camera={{ position: [3.5, 2, 4], fov: 42 }} fallback={<p>{ui(steps[stage])}</p>}>
        <ambientLight intensity={2} /><directionalLight position={[3,4,5]} intensity={3} />
        <mesh><sphereGeometry args={[1, 32, 24]} /><meshBasicMaterial wireframe color="#eac487" transparent opacity={.15} /></mesh>
        {stage === 0 && <mesh><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color="#eac487" transparent opacity={.5} /></mesh>}
        {stage === 1 && <>
          <mesh><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color="#eac487" transparent opacity={.15} /></mesh>
          <mesh><sphereGeometry args={[measurementT, 32, 24]} /><meshStandardMaterial color="#b97b8f" /></mesh>
        </>}
        {stage === 2 && <mesh rotation={[0, .7, 0]}><sphereGeometry args={[1, 32, 24, phi, Math.PI * 2 - phi]} /><meshStandardMaterial wireframe color="#b97b8f" transparent opacity={.6} side={DoubleSide} /></mesh>}
        {stage >= 2 && <group rotation={[0, .7, 0]}>
          <mesh><sphereGeometry args={[1, 16, 24, 0, phi]} /><meshStandardMaterial color="#f8cb7d" side={DoubleSide} /></mesh>
          <mesh><sphereGeometry args={[measurementT, 16, 24, 0, phi]} /><meshStandardMaterial color="#8e7654" side={DoubleSide} /></mesh>
          {[0, phi].map((angle) => <mesh key={angle} rotation={[0, angle, 0]}>
            <ringGeometry args={[measurementT, 1, 48, 1, Math.PI / 2, Math.PI]} /><meshStandardMaterial color="#cba365" side={DoubleSide} />
          </mesh>)}
        </group>}
        <mesh position={[0, 2 * measurementT - 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.1, 48]} /><meshBasicMaterial color="#9dd8d0" transparent opacity={.15} side={DoubleSide} />
        </mesh>
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas></SceneBoundary>
    </div>
    <p role="status" className="mt-2 text-center text-xs text-amber-100">{stage + 1}. {ui(steps[stage])}</p>
    <label className="mt-4 block text-xs text-zinc-300">{ui("Inner radius")} · {innerRadius.toFixed(2)} m
      <input className="mt-2 block w-full accent-amber-200" type="range" min="0" max="0.95" step="0.01" value={measurementT} onChange={(event) => setMeasurementT(Number(event.target.value))} />
    </label>
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums">
      <dt className="text-zinc-400">{ui("Outer radius")}</dt><dd>{DEFAULT_OUTER_RADIUS_M.toFixed(2)} m</dd>
      <dt className="text-zinc-400">{ui("Solid angle")}</dt><dd>{solidAngle.toFixed(4)} sr</dd>
      <dt className="text-zinc-400">Vouter</dt><dd>{volume.outer.toFixed(2)} m³</dd>
      <dt className="text-zinc-400">− Vinner</dt><dd>{volume.inner.toFixed(2)} m³</dd>
      <dt className="text-zinc-400">− Vangle</dt><dd>{volume.angleCut.toFixed(2)} m³</dd>
      <dt className="font-semibold text-amber-100">{ui("Geometric volume")}</dt><dd className="text-amber-100">{volume.result.toFixed(2)} m³</dd>
      <dt className="text-zinc-400">{ui("Remaining yield")}</dt><dd>{remaining.toFixed(2)} m³</dd>
    </dl>
    <p className="mt-3 text-[11px] leading-5 text-zinc-400">V = Vouter − Vinner − Vangle</p>
    <p className="text-[11px] leading-5 text-zinc-400">{ui("The geometric model uses an equal solid-angle share. Game yield is normalized:")} {EXTRACTION_RATE_M3} m³ / {ui("extraction")}. {ui("Angles are converted into removed volume.")}</p>
  </section>;
}
