import { useCallback, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { PatternView } from "../../../../games/party/minigames/patternWall/index.ts";
import type { MinigameViewProps } from "./views.ts";
import { COLORS } from "../../../../games/party/config.ts";

export default function PatternWallScreen({ minigame, match, playerId, now, online, sendInput }: MinigameViewProps) {
  const s = minigame.state as PatternView, me = s.players[playerId], sent = useRef("");
  const enabled = online && s.phase === "repeat" && me?.alive && me.step < s.length;
  const tap = useCallback((tile: number) => {
    const token = s.round + ":" + me?.step;
    if (!enabled || sent.current === token) return;
    sent.current = token; sendInput({ type: "PATTERN_TAP", tile, round: s.round, step: me.step });
  }, [enabled, s.round, me, sendInput]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement || e.repeat || !/^[1-9]$/.test(e.key)) return; e.preventDefault(); tap(Number(e.key) - 1); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [tap]);
  const flash = s.phase === "watch" ? s.lit : me && now - me.lastTapAt < 300 ? me.flashed : null;
  return <div className="wall-game new-minigame">
    <header className="new-game-header"><div><span className="pp-eyebrow">MEMORY LAB · ROUND {s.round}</span><h2>Echo Wall</h2></div><strong>{Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000))}s</strong></header>
    <div className="new-game-message" aria-live="polite"><b>{s.phase === "watch" ? "Watch the lights" : s.phase === "break" ? "Round complete" : s.phase === "finished" ? "The wall has spoken!" : !me?.alive ? "Wrong pattern · you're out" : me.step === s.length ? "Perfect recall · waiting for others" : "Your turn · repeat the sequence"}</b><span>{s.length} lights · {me?.step ?? 0} / {s.length} repeated</span></div>
    <div className="wall-world">
      <Canvas orthographic camera={{ position: [0, 0, 7], zoom: 75 }} dpr={[1, 1.25]}>
        <color attach="background" args={["#101b32"]}/><hemisphereLight args={["#c6d4ff", "#1c234a", 2]}/><directionalLight position={[-3, 5, 6]} intensity={3}/>
        <mesh position={[0, 0, -.45]}><boxGeometry args={[3.75, 3.75, .7]}/><meshStandardMaterial color="#314462" roughness={.5} metalness={.4}/></mesh>
        {Array.from({ length: 9 }, (_, tile) => <group key={tile} position={[(tile % 3 - 1) * 1.16, (1 - Math.floor(tile / 3)) * 1.16, 0]}>
          <mesh><boxGeometry args={[1.02, 1.02, .22]}/><meshStandardMaterial color={flash === tile ? "#abfff0" : "#366178"} emissive={flash === tile ? "#75eed4" : "#163346"} emissiveIntensity={flash === tile ? 2 : .4} metalness={.25} roughness={.3}/></mesh>
          <Html center position={[0, 0, .15]}><button className={"wall-tile-button" + (flash === tile ? " lit" : "")} aria-label={"Square " + (tile + 1)} disabled={!enabled} onClick={() => tap(tile)}>{tile + 1}</button></Html>
        </group>)}
      </Canvas>
    </div>
    <div className="new-game-scores">{match.players.filter((p) => s.players[p.id]).map((p) => <div key={p.id} className={s.players[p.id].alive ? "" : "out"}><i style={{ background: COLORS[p.avatarId] }}/><span>{p.name}{p.id === playerId ? " · YOU" : ""}</span><b>{s.players[p.id].score}</b></div>)}</div>
    <p className="new-game-tip">Tap squares or press 1–9 · repeated lights are separate beats · wrong square eliminates you</p>
  </div>;
}
