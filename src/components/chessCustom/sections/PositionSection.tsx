import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { ArrowLeftRight, Copy, Eraser, FlipVertical2, MousePointer2, RotateCcw, Save, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { boardLayers, getLayer, isPlayable, sameCoord, squareName } from "@/games/chess/custom/engine/board";
import { setupFromFen } from "@/games/chess/custom/engine/fen";
import type { Coord, PlacedPiece, PositionSetup } from "@/games/chess/custom/engine/types";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { DRAG_MIME } from "@/games/chess/custom/editor/editorUtils";
import { getBoardTheme } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";
import Board2D from "../Board2D";
import PieceToken from "../PieceToken";
import { SimulationIcon } from "../icons/ChessCustomIcons";
import { Button, IconButton, NumberField, Panel, SectionHeading, Segmented, Select, Toggle, inputClass, labelClass } from "../ui";

type Brush = { kind: "piece"; type: string; team: string } | { kind: "eraser" } | { kind: "select" };
type DragPayload = { kind: "new"; type: string; team: string } | { kind: "move"; index: number };

/**
 * Two positions can be edited: the variant's starting position (saved with
 * it) and a scratch test position for trying a rule without changing the start.
 */
type Target = "start" | "test";

function SetupEditor() {
  useGameLanguage();
  const { variant, testSetup, dispatch, go, setSimulationSource, notify } = useEditor();
  const [target, setTarget] = useState<Target>("start");
  const theme = getBoardTheme(variant.theme.boardTheme);
  const [brush, setBrush] = useState<Brush>({ kind: "select" });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [fen, setFen] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [activeLayer, setActiveLayer] = useState(0);
  const layers = boardLayers(variant.board);
  const layer = getLayer(variant.board, activeLayer) ?? variant.board;
  const onLayer = (coord: Coord) => ({ ...coord, z: activeLayer });
  const setup = target === "start" ? variant.setup : testSetup;
  const pieces = setup.pieces;
  const selected = selectedIndex !== null ? pieces[selectedIndex] : undefined;

  const commit = (next: PositionSetup, coalesceKey?: string) =>
    target === "start" ? dispatch({ type: "update", recipe: (current) => ({ ...current, setup: next }), coalesceKey: coalesceKey && `start-${coalesceKey}` }) : dispatch({ type: "setTestSetup", setup: next, coalesceKey });
  const withPieces = (next: PlacedPiece[]) => commit({ ...setup, pieces: next });
  const simulate = (view: "3d" | "2d") => {
    setSimulationSource(target);
    go({ view: "create", step: "simulation" }, { search: view === "3d" ? "?view=3d" : "" });
  };
  const indexAt = (coord: Coord) => pieces.findIndex((piece) => sameCoord(piece, coord));

  function place(coord: Coord, type: string, team: string) {
    if (!isPlayable(variant.board, coord)) return notify(`${squareName(coord)}: ${ui("not playable")}`, "error");
    const next = pieces.filter((piece) => !sameCoord(piece, coord));
    next.push({ type, team, x: coord.x, y: coord.y, z: coord.z ?? 0 });
    withPieces(next);
    setSelectedIndex(next.length - 1);
  }

  function handleDrop(coord: Coord, payload: string, duplicate: boolean) {
    const data = JSON.parse(payload) as DragPayload;
    if (data.kind === "new") return place(coord, data.type, data.team);
    const source = pieces[data.index];
    if (!source || sameCoord(source, coord)) return;
    if (!isPlayable(variant.board, coord)) return notify(`${squareName(coord)}: ${ui("not playable")}`, "error");
    const moved: PlacedPiece = { ...source, x: coord.x, y: coord.y, z: coord.z ?? 0 };
    const next = pieces.filter((piece, index) => !sameCoord(piece, coord) && (duplicate || index !== data.index));
    next.push(moved);
    withPieces(next);
    setSelectedIndex(next.length - 1);
  }

  function handleClick(coord: Coord) {
    if (brush.kind === "piece") return place(coord, brush.type, brush.team);
    const index = indexAt(coord);
    if (brush.kind === "eraser") {
      if (index >= 0) withPieces(pieces.filter((_, position) => position !== index));
      return;
    }
    setSelectedIndex(index >= 0 ? index : null);
  }

  function duplicateSelected() {
    if (!selected) return;
    const spot = layer.cells
      .filter((cell) => isPlayable(variant.board, { ...cell, z: activeLayer }) && indexAt({ ...cell, z: activeLayer }) < 0)
      .sort((a, b) => Math.max(Math.abs(a.x - selected.x), Math.abs(a.y - selected.y)) - Math.max(Math.abs(b.x - selected.x), Math.abs(b.y - selected.y)))[0];
    if (!spot) return notify(ui("No free square for a copy"), "error");
    withPieces([...pieces, { ...selected, x: spot.x, y: spot.y, z: activeLayer }]);
    setSelectedIndex(pieces.length);
  }

  const boardPieces = useMemo(() => pieces.flatMap((piece, index) => (piece.z ?? 0) === activeLayer ? [{ ...piece, key: String(index) }] : []), [pieces, activeLayer]);
  const highlights = useMemo(() => new Map(selected && (selected.z ?? 0) === activeLayer ? [[`${selected.x},${selected.y}`, "selected" as const]] : []), [selected, activeLayer]);

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
      <Panel title={ui("Piece palette")} eyebrow={ui("Drag onto the board or click to paint")}>
        <div className="mb-3 flex gap-1.5">
          <IconButton label={ui("Select & drag pieces")} active={brush.kind === "select"} onClick={() => setBrush({ kind: "select" })}>
            <MousePointer2 size={15} />
          </IconButton>
          <IconButton label={ui("Eraser — click pieces to remove (or right-click)")} active={brush.kind === "eraser"} onClick={() => setBrush({ kind: "eraser" })}>
            <Eraser size={15} />
          </IconButton>
        </div>
        {variant.teams.map((team) => (
          <div key={team.id} className="mb-3">
            <p className={labelClass}>{gameUi(team.name)}</p>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {variant.pieces
                .filter((def) => !def.teams || def.teams.includes(team.id))
                .map((def) => {
                  const active = brush.kind === "piece" && brush.type === def.id && brush.team === team.id;
                  const placed = pieces.filter((piece) => piece.type === def.id && piece.team === team.id).length;
                  const suggested = def.spawnAmount ?? 0;
                  return (
                    <button
                      key={def.id}
                      type="button"
                      draggable
                      title={gameUi(`${team.name} ${def.name}${suggested ? ` — ${placed} of ${suggested} suggested placed` : ""}`)}
                      aria-pressed={active}
                      onDragStart={(event) => event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind: "new", type: def.id, team: team.id } satisfies DragPayload))}
                      onClick={() => setBrush(active ? { kind: "select" } : { kind: "piece", type: def.id, team: team.id })}
                      className={`relative aspect-square rounded-lg border p-0.5 transition ${active ? "border-sky-400/70 bg-sky-400/15" : "border-white/[0.08] bg-black/30 hover:border-white/25"}`}
                    >
                      <PieceToken def={def} team={team} />
                      {gameUi(suggested > 0 && (
                        <span className={`absolute bottom-0 right-0.5 text-[9px] font-bold ${placed === suggested ? "text-emerald-300" : placed > suggested ? "text-amber-300" : "text-zinc-500"}`}>
                          {gameUi(placed)}/{gameUi(suggested)}
                        </span>
                      ))}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
        <p className="text-[11px] leading-5 text-zinc-500">{ui("Alt/Option-drag a piece on the board to duplicate it. Right-click removes.")}</p>
      </Panel>

      <div className="min-w-0 space-y-3">
        {layers.length > 1 && <label className="flex items-center gap-2 text-xs text-zinc-300">{gameUi("Edit layer ")}<select aria-label={gameUi("Setup layer")} value={activeLayer} onChange={(event) => { setActiveLayer(Number(event.target.value)); setSelectedIndex(null); }} className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-white">{layers.map((entry) => <option key={entry.z} value={entry.z}>{gameUi(entry.name)} · {gameUi(entry.width)}×{gameUi(entry.height)}</option>)}</select></label>}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label={gameUi("Position to edit")}
            value={target}
            onChange={(next) => {
              setTarget(next);
              setSelectedIndex(null);
            }}
            options={[
              { id: "start", label: "Starting position", title: "Saved with the variant: every game starts here." },
              { id: "test", label: "Test position", title: "A scratch position for trying rules. Not saved." },
            ]}
          />
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <Button tone="primary" onClick={() => simulate("2d")}>
            <SimulationIcon size={16} />
            {ui("Simulate in 2D")}
          </Button>
          <Button tone="blue" onClick={() => simulate("3d")}>
            {ui("Simulate in 3D")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {gameUi(target === "start" ? (
            <Button size="sm" onClick={() => dispatch({ type: "arrangeArmies" })} title={ui("Place each team's suggested pieces on its home ranks")}>
              <Users size={14} />
              {ui("Arrange armies")}
            </Button>
          ) : (
            <Button size="sm" onClick={() => commit(structuredClone(variant.setup))} title={ui("Reset to the variant's starting position")}>
              <RotateCcw size={14} />
              {ui("Reset to starting position")}
            </Button>
          ))}
          <Button size="sm" onClick={() => withPieces([])}>
            <Trash2 size={14} />
            {ui("Clear board")}
          </Button>
          {gameUi(target === "test" && (
            <Button
              size="sm"
              onClick={() => {
                dispatch({ type: "update", recipe: (current) => ({ ...current, setup: structuredClone(testSetup) }) });
                notify(ui("Saved as the variant's starting position"));
              }}
            >
              <Save size={14} />
              {ui("Use as starting position")}
            </Button>
          ))}
          <IconButton label={ui("Flip board")} active={flipped} onClick={() => setFlipped((value) => !value)}>
            <FlipVertical2 size={15} />
          </IconButton>
        </div>
        <div className="mx-auto max-w-[min(100%,calc(var(--app-height)-300px))]">
          <Board2D
            board={layer}
            variant={variant}
            theme={theme}
            pieces={boardPieces}
            highlights={highlights}
            flipped={flipped}
            label={gameUi(target === "start" ? ui("Starting position editor") : ui("Test position editor"))}
            onCellClick={(coord) => handleClick(onLayer(coord))}
            onCellContextMenu={(coord) => {
              const index = indexAt(onLayer(coord));
              if (index >= 0) withPieces(pieces.filter((_, position) => position !== index));
            }}
            onDropPayload={(coord, payload, event) => handleDrop(onLayer(coord), payload, event.altKey)}
            onPieceDragStart={(piece, event) => {
              event.dataTransfer.effectAllowed = "copyMove";
              event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind: "move", index: Number(piece.key) } satisfies DragPayload));
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Panel title={gameUi(selected ? `${variant.pieces.find((def) => def.id === selected.type)?.name ?? selected.type} · ${squareName(selected)}` : ui("Selected piece"))}>
          {gameUi(selected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const others = variant.teams.map((team) => team.id);
                    const team = others[(others.indexOf(selected.team) + 1) % others.length];
                    withPieces(pieces.map((piece, index) => (index === selectedIndex ? { ...piece, team } : piece)));
                  }}
                >
                  <ArrowLeftRight size={13} />
                  {ui("Switch team")}
                </Button>
                <Button size="sm" onClick={duplicateSelected}>
                  <Copy size={13} />
                  {ui("Duplicate")}
                </Button>
                <Button
                  size="sm"
                  tone="danger"
                  onClick={() => {
                    withPieces(pieces.filter((_, index) => index !== selectedIndex));
                    setSelectedIndex(null);
                  }}
                >
                  <Trash2 size={13} />
                  {ui("Remove")}
                </Button>
              </div>
              <Toggle
                checked={Boolean(selected.moved)}
                onChange={(moved) => withPieces(pieces.map((piece, index) => (index === selectedIndex ? { ...piece, moved: moved || undefined } : piece)))}
                label={ui("Has already moved")}
                description={ui("Disables first-move rules and castling for this piece.")}
              />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">{ui("Click a piece to change its team, duplicate or remove it.")}</p>
          ))}
        </Panel>

        <Panel title={ui("Game state")}>
          <div className="space-y-3">
            <div>
              <p className={labelClass}>{ui("Side to move")}</p>
              <Select label={gameUi("Side to move")} className="mt-1.5" value={setup.startingTeam} onChange={(startingTeam) => commit({ ...setup, startingTeam })} options={variant.teams.map((team) => ({ id: team.id, label: team.name }))} />
            </div>
            <div>
              <p className={labelClass}>{ui("Move counter")}</p>
              <NumberField label={gameUi("Move counter")} value={setup.turnNumber} min={1} max={500} onChange={(turnNumber) => commit({ ...setup, turnNumber }, "turn-number")} />
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const setup = setupFromFen(fen);
                if (!setup || !setup.pieces.every((piece) => variant.pieces.some((def) => def.id === piece.type))) return notify(ui("That FEN needs the standard pieces (pawn, knight, bishop, rook, queen, king)."), "error");
                commit(setup);
                notify(ui("Position imported from FEN"));
              }}
            >
              <p className={labelClass}>{ui("Import FEN")}</p>
              <div className="mt-1.5 flex gap-2">
                <input value={fen} onChange={(event) => setFen(event.target.value)} placeholder={gameUi("rnbqkbnr/pppppppp/8/…")} className={`${inputClass} py-1.5 font-mono text-xs`} />
                <Button size="sm" type="submit" disabled={!fen.trim()}>
                  {ui("Load")}
                </Button>
              </div>
            </form>
            <p className="text-xs text-zinc-500">
              {gameUi(pieces.length)} {ui("pieces placed")} · {gameUi(variant.teams.map((team) => `${team.name} ${pieces.filter((piece) => piece.team === team.id).length}`).join(" · "))}
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function PositionSection() {
  useGameLanguage();
  return (
    <div>
      <SectionHeading
        step="position"
        eyebrow="Position"
        title={gameUi("Set the starting position")}
        description={ui("Place, move, duplicate and remove pieces on every layer to define how your variant begins. Switch to Test position to try a rule from any layout without changing the start.")}
      />
      <SetupEditor />
    </div>
  );
}
