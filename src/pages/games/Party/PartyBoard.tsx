import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import type { BoardOverlay } from "../../../games/party/board/renderer.ts";
import type { BoardMap, Match } from "../../../games/party/types.ts";
import { activePlayer } from "../../../games/party/engine/engine.ts";
import { spaceNumber } from "../../../games/party/engine/graph.ts";
import { BoardWorld } from "./BoardWorld.tsx";
import { useBoardLanding } from "./useBoardLanding.ts";
import type { BoardLanding } from "../../../games/party/board/fieldDesign.ts";
import { useSceneMotion } from "./minigames/useSceneMotion.ts";
import { partyAudio } from "../../../games/party/client/audio.ts";

export default function PartyBoard({ map, match, onSelect, overlay = null, explosion = null, preview = false, cameraMode = "pawn", cameraReset = 0, children }: {
  map: BoardMap; match: Match | null; onSelect: (id: string) => void; overlay?: BoardOverlay | null;
  explosion?: { id: number; nodeId: string; kind: "melon" | "fallout" } | null; preview?: boolean;
  cameraMode?: "pawn" | "whole"; cameraReset?: number; children?: ReactNode;
}) {
  useGameLanguage();
  const activeNodeId = match ? activePlayer(match).currentNodeId : null;
  const turnKey = `${match?.round}:${match?.turnIndex}`;
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 600px)").matches);
  useEffect(() => { const query = window.matchMedia("(max-width: 600px)"); const changed = () => setMobile(query.matches); query.addEventListener("change", changed); return () => query.removeEventListener("change", changed); }, []);
  const decisionKey = `${cameraMode}:${cameraReset}:${turnKey}:${activeNodeId}:${match?.phase}:${mobile}`;
  const focusRequest = `${cameraMode}:${cameraReset}:${turnKey}:${match?.phase === "PATH_SELECTION" ? "path" : "turn"}`;
  const [cameraView, setCameraView] = useState<{ key: string; focus: string | null; zoom: number }>({ key: "", focus: null, zoom: 1.15 });
  const [inspected, setInspected] = useState("");
  const [landing, setLanding] = useState<BoardLanding | null>(null);
  const landingTimer = useRef<number | null>(null), flight = useRef<HTMLDivElement>(null), motion = useSceneMotion();
  const vaultSoundTimer = useRef<number | null>(null);
  useBoardLanding(match, map, (next) => {
    setLanding(next);
    if (landingTimer.current !== null) clearTimeout(landingTimer.current);
    if (vaultSoundTimer.current !== null) clearTimeout(vaultSoundTimer.current);
    if (next.kind === "deposit" || next.kind === "bank") vaultSoundTimer.current = window.setTimeout(() => partyAudio.play("click"), 1550);
    landingTimer.current = window.setTimeout(() => setLanding(null), 2100);
  });
  useEffect(() => () => { if (landingTimer.current !== null) clearTimeout(landingTimer.current); if (vaultSoundTimer.current !== null) clearTimeout(vaultSoundTimer.current); }, []);
  const projectReward = (x: number, y: number) => {
    const element = flight.current; if (!element || !landing) return;
    const counter = [...document.querySelectorAll<HTMLElement>("[data-coin-counter]")].find((e) => e.dataset.coinCounter === landing.playerId);
    const board = element.getBoundingClientRect(), target = counter?.getBoundingClientRect();
    if (!target) return;
    const tx = target.x + target.width / 2 - board.x, ty = target.y + target.height / 2 - board.y, deposit = landing.kind === "deposit";
    element.style.setProperty("--coin-from-x", `${deposit ? tx : x}px`); element.style.setProperty("--coin-from-y", `${deposit ? ty : y}px`);
    element.style.setProperty("--coin-to-x", `${deposit ? x : tx}px`); element.style.setProperty("--coin-to-y", `${deposit ? y : ty}px`);
    element.style.visibility = "visible";
  };
  const view = cameraView.key === decisionKey ? cameraView : {
    key: decisionKey,
    focus: cameraMode === "whole" || preview ? null : activeNodeId,
    zoom: cameraMode === "whole" ? map.theme === "mountain" ? .95 : 1.15 : preview || !match ? 1.15 : match.phase === "PATH_SELECTION" ? mobile ? 4.8 : 2.8 : mobile ? 3.8 : 2.6,
  };
  const { focus, zoom } = view;
  const setZoom = (change: (zoom: number) => number) => setCameraView({ ...view, key: decisionKey, zoom: change(view.zoom) });
  const select = (id: string) => { setInspected(id); onSelect(id); };
  return <div className={"pp-board pp-board-3d pp-board-" + map.theme + (preview ? " pp-board-preview" : "")}>
    {/* Measure layout dimensions so the tilted menu poster cannot enlarge its own canvas. */}
    <Canvas resize={{ offsetSize: true }} dpr={[1, 1.35]} frameloop={preview ? "demand" : "always"} gl={{ antialias: true }} fallback={<p>This board needs a browser with WebGL enabled.</p>}>
      <BoardWorld map={map} match={match} onSelect={select} overlay={overlay} explosion={explosion} preview={preview} focus={focus} zoom={zoom} cameraReset={focusRequest} overview={cameraMode === "whole" && !preview} landing={landing} onProjectReward={projectReward}/>
    </Canvas>
    {!preview && <>
      {motion && landing && landing.amount > 0 && ["coin", "boost", "bank", "deposit"].includes(landing.kind) && <div key={landing.id} ref={flight} className="pp-coin-flight" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} style={{ animationDelay: `${i * .09}s` }}>◉</i>)}</div>}
      <div className="pp-board-tools">
        {gameUi(children)}
        <div className="pp-camera" role="group" aria-label={gameUi("Board zoom")}><button aria-label={gameUi("Zoom out")} onClick={() => setZoom((z) => Math.max(.7, z - .4))}>−</button><span>{gameUi("Drag to explore")}</span><button aria-label={gameUi("Zoom in")} onClick={() => setZoom((z) => Math.min(5.5, z + .4))}>+</button></div>
      </div>
      <span className="pp-map-caption">{gameUi(map.name.toUpperCase())} · {gameUi(map.nodes.length)}{gameUi(" SPACES · DRAG TO EXPLORE")}</span>
      <details className="pp-board-access"><summary>{gameUi("Choose a space")}</summary><label>{gameUi("Board space")}<select value={inspected} onChange={(e) => select(e.target.value)}><option value="">{gameUi("Select a space…")}</option>{map.nodes.map((n) => <option key={n.id} value={n.id}>{gameUi("Space ")}{gameUi(spaceNumber(n.id))} · {gameUi(map.cleansingNodeIds?.includes(n.id) ? "cleanse +10 HP" : n.type)} · {gameUi(map.regions[n.region].name)}</option>)}</select></label></details>
    </>}
  </div>;
}
