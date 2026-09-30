import { useEffect, useRef, useState } from "react";
import {
  PartyRenderer,
  type BoardOverlay,
} from "../../../games/party/board/renderer.ts";
import type { BoardMap, Match } from "../../../games/party/types.ts";
import { activePlayer } from "../../../games/party/engine/engine.ts";
import { spaceNumber } from "../../../games/party/engine/graph.ts";
import { prefersReducedMotion } from "../../../games/party/client/preferences.ts";
export default function PartyBoard({
  map,
  match,
  onSelect,
  overlay = null,
  explosion = null,
  preview = false,
}: {
  map: BoardMap;
  match: Match | null;
  onSelect: (id: string) => void;
  overlay?: BoardOverlay | null;
  explosion?: { id: number; nodeId: string; kind: "melon" | "fallout" } | null;
  preview?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    renderer = useRef<PartyRenderer | null>(null);
  const latest = useRef({ match, onSelect, overlay });
  // A short camera fly-to with a banner: a new Golden Pluto, an Avalanche, or a forced move.
  const [banner, setBanner] = useState<string | null>(null);
  const lastSpawn = useRef(match?.plutoSpawn.sequence ?? 0);
  const lastBlock = useRef(match?.blockedConnections.at(-1)?.id ?? null);
  const lastForced = useRef(match?.forcedMove?.sequence ?? 0);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    latest.current = { match, onSelect, overlay };
    zoomRef.current = zoom;
    renderer.current?.update(match, overlay);
  }, [match, onSelect, overlay, zoom]);
  const explosionId = explosion?.id,
    explosionNode = explosion?.nodeId,
    explosionKind = explosion?.kind;
  useEffect(() => {
    if (explosionNode) renderer.current?.explode(explosionNode, explosionKind);
  }, [explosionId, explosionNode, explosionKind]);
  useEffect(() => {
    // One renderer per map: a match never changes map, so this mounts once per board.
    const board = new PartyRenderer(map);
    let cancelled = false;
    void board
      .init(host.current!, (id) => latest.current.onSelect(id))
      .then(() => {
        if (cancelled) board.destroy();
        else {
          renderer.current = board;
          setReady(true);
          board.update(latest.current.match, latest.current.overlay);
          // Start the camera on the active pawn (Mountain is taller than the viewport).
          const state = latest.current.match;
          if (state) requestAnimationFrame(() => panTo(activePlayer(state).currentNodeId));
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "The animated board could not load. Try a browser with WebGL enabled.",
          );
      });
    return () => {
      cancelled = true;
      if (renderer.current === board) {
        board.destroy();
        renderer.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  const focus = () => {
    if (match) panTo(activePlayer(match).currentNodeId);
  };
  function panToPoint(x: number, y: number) {
    const element = viewport.current;
    if (!element || !host.current) return;
    element.scrollTo({
      left: (x / map.size.width) * host.current.clientWidth - element.clientWidth / 2,
      top: (y / map.size.height) * host.current.clientHeight - element.clientHeight / 2,
      behavior: prefersReducedMotion() ? "instant" : "smooth",
    });
  }
  function panTo(nodeId: string) {
    const node = map.nodes.find((n) => n.id === nodeId);
    if (node) panToPoint(node.x, node.y);
  }
  // Fly to a point at a readable zoom, show a banner, then return to the active player's pawn.
  function flyTo(x: number, y: number, text: string, holdMs: number) {
    const previousZoom = zoomRef.current;
    const frames: number[] = [];
    frames.push(
      requestAnimationFrame(() => {
        setBanner(text);
        setZoom(Math.max(previousZoom, 1.8));
        frames.push(requestAnimationFrame(() => panToPoint(x, y)));
      }),
    );
    const timer = setTimeout(() => {
      setBanner(null);
      setZoom(previousZoom);
      frames.push(
        requestAnimationFrame(() => {
          const state = latest.current.match;
          if (state) panTo(activePlayer(state).currentNodeId);
        }),
      );
    }, holdMs);
    return () => {
      clearTimeout(timer);
      frames.forEach(cancelAnimationFrame);
    };
  }
  // Camera correction: when the active pawn moves out of the visible window, bring it back into view.
  const activeNode = match ? activePlayer(match).currentNodeId : null;
  useEffect(() => {
    const element = viewport.current,
      canvas = host.current,
      node = activeNode ? map.nodes.find((n) => n.id === activeNode) : null;
    if (preview || !element || !canvas || !node) return;
    const x = (node.x / map.size.width) * canvas.clientWidth,
      y = (node.y / map.size.height) * canvas.clientHeight,
      margin = 70;
    if (
      x < element.scrollLeft + margin ||
      x > element.scrollLeft + element.clientWidth - margin ||
      y < element.scrollTop + margin ||
      y > element.scrollTop + element.clientHeight - margin
    )
      panToPoint(node.x, node.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNode, zoom]);
  const spawnSequence = match?.plutoSpawn.sequence ?? 0;
  const spawnNode = match?.plutoSpawn.nodeId;
  useEffect(() => {
    if (!spawnNode || spawnSequence === lastSpawn.current) return;
    lastSpawn.current = spawnSequence;
    const node = map.nodes.find((n) => n.id === spawnNode);
    if (!node) return;
    return flyTo(node.x, node.y, `✦ New Golden Pluto! Space ${spaceNumber(spawnNode)}`, 2800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnSequence, spawnNode]);
  // Avalanche: the server closed a route; show it before anyone chooses it.
  const newestBlock = match?.blockedConnections.at(-1);
  const blockId = newestBlock?.id ?? null;
  useEffect(() => {
    if (!newestBlock || blockId === lastBlock.current) {
      lastBlock.current = blockId;
      return;
    }
    lastBlock.current = blockId;
    const a = map.nodes.find((n) => n.id === newestBlock.fromNodeId),
      b = map.nodes.find((n) => n.id === newestBlock.toNodeId);
    if (!a || !b) return;
    return flyTo((a.x + b.x) / 2, (a.y + b.y) / 2, "🏔️ AVALANCHE! Path blocked", 3200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);
  // Cable Car / Mine Cart rides and Frozen Slides move a pawn without dice: keep them in view.
  const forced = match?.forcedMove;
  const forcedSeq = forced?.sequence ?? 0;
  useEffect(() => {
    if (!forced || forcedSeq === lastForced.current) {
      lastForced.current = forcedSeq;
      return;
    }
    lastForced.current = forcedSeq;
    const end = map.nodes.find((n) => n.id === forced.path[forced.path.length - 1]);
    if (!end) return;
    const text =
      forced.kind === "slide"
        ? "🧊 SLIDE!"
        : forced.kind === "cable-car"
          ? "🚡 Cable Car"
          : "⛏️ Mine Cart";
    return flyTo(end.x, end.y, text, 2200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedSeq]);
  return (
    <div
      className={`pp-board pp-board-${map.theme} ${preview ? "pp-board-preview" : ""}`}
    >
      <div className="pp-board-scroll" ref={viewport}>
        <div
          ref={host}
          className="pp-canvas"
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
      {banner && (
        <div role="status" className="pp-pluto-arrival">
          {banner}
        </div>
      )}
      {!ready && !error && (
        <p role="status" className="pp-board-loading">
          <span className="pp-spinner small" aria-hidden="true" /> Loading the board…
        </p>
      )}
      {error && (
        <p role="alert" className="pp-board-error">
          {error}
        </p>
      )}
      {!preview && (
        <div className="pp-camera">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          >
            −
          </button>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
          >
            +
          </button>
          <button onClick={focus}>Find pawn</button>
          <button onClick={() => setZoom(1)}>Fit</button>
        </div>
      )}
      {!preview && (
        <span className="pp-map-caption">
          {map.name.toUpperCase()} <i>•</i> {map.nodes.length} SPACES
        </span>
      )}
    </div>
  );
}
