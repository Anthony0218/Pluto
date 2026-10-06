import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PartyCharacter } from "../src/pages/games/Party/minigames/PartyCharacter.tsx";
import { CHARACTER_NAMES } from "../src/pages/games/Party/minigames/characterRoster.ts";
import { createRoot } from "react-dom/client";
import { arrowMemory } from "../src/games/party/minigames/arrowMemory/index.ts";
import { pickupArena } from "../src/games/party/minigames/pickupArena/index.ts";
import PartyBoard from "../src/pages/games/Party/PartyBoard.tsx";
import { mapRegistry } from "../src/games/party/content/maps.ts";
import type { ArenaState } from "../src/games/party/minigames/pickupArena/index.ts";
import { minigameViews } from "../src/pages/games/Party/minigames/views.ts";
import { createMatch, createPlayer } from "../src/games/party/engine/engine.ts";
import { COLORS, DEFAULT_SETTINGS } from "../src/games/party/config.ts";
import { startDuelMinigame, startMinigame, applyMinigameInput, publicMinigameView, stepMinigameBots, simulateMinigame } from "../src/games/party/minigames/flow.ts";
import type { Match, MinigameInput } from "../src/games/party/types.ts";
import "../src/pages/games/Party/party.css";

export function Playground() {
  const live = useRef<Match | null>(null), [snapshot, setSnapshot] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [showCast, setShowCast] = useState(false);
  const [boardMap, setBoardMap] = useState<string | null>(null);
  const [boardMatch, setBoardMatch] = useState<Match | null>(null);
  const rng = useRef(() => Math.random());
  const publish = useCallback(() => {
    const m = live.current; if (!m?.minigame) return;
    setSnapshot({ ...m, minigame: publicMinigameView(m.minigame, Date.now(), undefined, "p0") });
  }, []);
  const start = (id: string, map: number, practice = false) => {
    setShowCast(false);
    setBoardMap(null);
    let seed = 19;
    rng.current = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const players = ["You", "Nova", "Orion", "Luna"].map((name, i) => ({ ...createPlayer(`p${i}`, name, i), isBot: !practice && i > 0 }));
    const m = createMatch(players, DEFAULT_SETTINGS, rng.current); m.order = players.map((p) => p.id);
    let first = true;
    const random = () => { if (first) { first = false; return map; } return rng.current(); };
    if (id === "street-cross") startDuelMinigame(m, id, ["p0", "p1"], random, Date.now() - 7000);
    else startMinigame(m, id, random, Date.now() - 7000);
    m.minigame!.status = "ACTIVE"; m.phase = id === "street-cross" ? "DUEL_MINIGAME" : "MINIGAME";
    if (practice) {
      const s = m.minigame!.state as ArenaState;
      Object.assign(s.players.p0, { x: 0, y: 0, z: 0, yaw: 0, hp: 72, weapon: "desert-eagle", ammo: 7, protectedUntil: 0 });
      Object.assign(s.players.p1, { x: 0, y: 0, z: -5, yaw: Math.PI, protectedUntil: 0 });
      Object.assign(s.players.p2, { x: 18, y: 0, z: 18 }); Object.assign(s.players.p3, { x: -18, y: 0, z: 18 });
      if (s.map === "arcade") {
        Object.assign(s.players.p0, { x: 0, y: 0, z: 13 }); Object.assign(s.players.p1, { x: 2, y: 0, z: 8 });
        Object.assign(s.players.p2, { x: -9, y: 4, z: 12 }); Object.assign(s.players.p3, { x: 9, y: 8, z: 12 });
      }
    }
    live.current = m; setError(""); publish();
  };
  useEffect(() => {
    const timer = setInterval(() => {
      if (!live.current?.minigame) return;
      const now = Date.now();
      if (!simulateMinigame(live.current, now).finished) live.current = stepMinigameBots(live.current, now, rng.current).match;
      publish();
    }, 100);
    return () => clearInterval(timer);
  }, [publish]);
  const sendInput = useCallback((input: MinigameInput) => {
    if (!live.current) return;
    try { live.current = applyMinigameInput(live.current, "p0", input, Date.now()); setError(""); publish(); }
    catch (e) { setError(e instanceof Error ? e.message : "Input rejected"); }
  }, [publish]);
  const View = snapshot?.minigame && minigameViews[snapshot.minigame.minigameId];
  const previewBoard = (mapId: string) => {
    live.current = null; setSnapshot(null); setShowCast(false); setBoardMap(mapId);
    const players = ["You", "Nova", "Orion", "Luna"].map((name, i) => createPlayer("p" + i, name, i));
    const m = createMatch(players, { ...DEFAULT_SETTINGS, mapId }, rng.current);
    players.forEach((_, i) => { m.players[i].currentNodeId = mapRegistry.get(mapId).nodes[i * 13].id; }); setBoardMatch(m);
  };
  return <main className={"pp-page" + (boardMap || snapshot ? " pp-immersive" : "")} style={{ minHeight: "100vh", padding: boardMap || snapshot ? 0 : 24, background: "#071321" }}>
    <details style={{ position: "absolute", top: 8, left: 8, zIndex: 60, color: "#fff", background: "#071321de", borderRadius: 10, padding: 8 }}><summary>Preview games</summary>
    <nav style={{ display: "flex", gap: "8px", flexWrap: "wrap", maxWidth: 570, color: "#fff" }}>
      <button style={{ color: "#fff" }} onClick={() => previewBoard("sunspill")}>Sunspill board</button>
      <button style={{ color: "#fff" }} onClick={() => previewBoard("mountain")}>Mountain board</button>
      <button style={{ color: "#fff" }} onClick={() => start("pattern-wall", 0)}>Echo Wall</button>
      <button style={{ color: "#fff" }} onClick={() => start("trail-run", 0)}>Triple Trail</button>
      <button style={{ color: "#fff" }} onClick={() => start("rhythm-rush", 0)}>Pluto Pulse</button>
      <button style={{ color: "#fff" }} onClick={() => start("circle-shot", 0)}>Circle Quickshot</button>
      <button style={{ color: "#fff" }} onClick={() => start("lava-knockback", 0)}>Hell Knockout</button>
      <button style={{ color: "#fff" }} onClick={() => start(arrowMemory.id, 0)}>Ice memory</button>
      <button style={{ color: "#fff" }} onClick={() => start(arrowMemory.id, 0.99)}>Hell memory</button>
      <button style={{ color: "#fff" }} onClick={() => start(pickupArena.id, 0)}>Arcade shooter</button>
      <button style={{ color: "#fff" }} onClick={() => start(pickupArena.id, 0.99)}>City shooter</button>
      <button style={{ color: "#fff" }} onClick={() => start(pickupArena.id, 0.99, true)}>Weapon practice</button>
      <button style={{ color: "#fff" }} onClick={() => start(pickupArena.id, 0, true)}>Arcade tour</button>
      <button style={{ color: "#fff" }} onClick={() => start("street-cross", 0)}>Street Cross duel</button>
      <button style={{ color: "#fff" }} onClick={() => { live.current = null; setSnapshot(null); setBoardMap(null); setShowCast(true); }}>Character cast</button>
    </nav></details>
    {error && <p role="alert" style={{ color: "#ffaeb4" }}>{error}</p>}
    {boardMap ? <section className="pp-match"><PartyBoard map={mapRegistry.get(boardMap)} match={boardMatch} onSelect={() => {}}/></section> : showCast ? <section style={{ color: "#e7f2ff", background: "#13263b", borderRadius: 20, padding: 20 }}>
      <h2>The Pluto crew</h2><p>Fox · Bunny · Explorer · Ghost</p>
      <div style={{ height: 420 }}><Canvas shadows camera={{ position: [0, 3.4, 10], fov: 40 }} dpr={[1, 1.5]}>
        <color attach="background" args={["#13263b"]}/><hemisphereLight args={["#e5f5ff", "#547381", 2]}/><directionalLight position={[-3, 6, 6]} intensity={2.5}/>
        {CHARACTER_NAMES.map((_, i) => <group key={i} position={[(i - 1.5) * 1.8, 0, 0]} rotation={[0, Math.PI, 0]}><PartyCharacter avatarId={i} color={COLORS[i]}/></group>)}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}><circleGeometry args={[8, 64]}/><meshStandardMaterial color="#234459" roughness={0.8}/></mesh>
        <OrbitControls target={[0, 0.85, 0]} enablePan={false} minDistance={5} maxDistance={15} maxPolarAngle={Math.PI / 2 - 0.05}/>
      </Canvas></div>
    </section> : View && snapshot?.minigame ? <div className="pp-card mg-stage"><View key={snapshot.minigame.startedAt} match={snapshot} minigame={snapshot.minigame} playerId="p0" online now={snapshot.minigame.serverNow ?? 0} sendInput={sendInput}/></div> : <p style={{ color: "#fff" }}>Choose a map to play against three bots.</p>}
  </main>;
}
const root = createRoot(document.getElementById("root")!);
root.render(<Playground/>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
