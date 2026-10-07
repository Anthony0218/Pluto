import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { BoardOverlay } from "../../../games/party/board/renderer.ts";
import type { BoardMap, Match } from "../../../games/party/types.ts";
import { activePlayer } from "../../../games/party/engine/engine.ts";
import { spaceNumber } from "../../../games/party/engine/graph.ts";
import { BoardWorld } from "./BoardWorld.tsx";

export default function PartyBoard({ map, match, onSelect, overlay = null, explosion = null, preview = false }: {
  map: BoardMap; match: Match | null; onSelect: (id: string) => void; overlay?: BoardOverlay | null;
  explosion?: { id: number; nodeId: string; kind: "melon" | "fallout" } | null; preview?: boolean;
}) {
  const [focus, setFocus] = useState<string | null>(null), [zoom, setZoom] = useState(1.15), [inspected, setInspected] = useState("");
  const select = (id: string) => { setInspected(id); onSelect(id); };
  return <div className={"pp-board pp-board-3d pp-board-" + map.theme + (preview ? " pp-board-preview" : "")}>
    {/* Measure layout dimensions so the tilted menu poster cannot enlarge its own canvas. */}
    <Canvas resize={{ offsetSize: true }} dpr={[1, 1.35]} frameloop={preview ? "demand" : "always"} gl={{ antialias: true }} fallback={<p>This board needs a browser with WebGL enabled.</p>}>
      <BoardWorld map={map} match={match} onSelect={select} overlay={overlay} explosion={explosion} preview={preview} focus={focus} zoom={zoom}/>
    </Canvas>
    {!preview && <>
      <div className="pp-camera"><button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(.7, z - .4))}>−</button><button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3.5, z + .4))}>+</button>
        <button onClick={() => { if (match) setFocus(activePlayer(match).currentNodeId); setZoom(2.1); }}>Find pawn</button><button onClick={() => { setFocus(null); setZoom(1.15); }}>Fit board</button></div>
      <span className="pp-map-caption">{map.name.toUpperCase()} · {map.nodes.length} SPACES · DRAG TO EXPLORE</span>
      <details className="pp-board-access"><summary>Choose a space</summary><label>Board space<select value={inspected} onChange={(e) => select(e.target.value)}><option value="">Select a space…</option>{map.nodes.map((n) => <option key={n.id} value={n.id}>Space {spaceNumber(n.id)} · {n.type} · {map.regions[n.region].name}</option>)}</select></label></details>
    </>}
  </div>;
}
