import { ArrowLeftRight, Box, Copy, Eraser, FlipVertical2, MousePointer2, Play, RotateCcw, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { isPlayable, sameCoord, squareName } from "@/games/chess/custom/engine/board";
import { setupFromFen } from "@/games/chess/custom/engine/fen";
import type { Coord, PlacedPiece, PositionSetup } from "@/games/chess/custom/engine/types";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { DRAG_MIME } from "@/games/chess/custom/editor/editorUtils";
import { getBoardTheme } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";
import Board2D from "../Board2D";
import PieceToken from "../PieceToken";
import { Button, IconButton, NumberField, Panel, SectionHeading, Select, Toggle, inputClass, labelClass } from "../ui";

type Brush = { kind: "piece"; type: string; team: string } | { kind: "eraser" } | { kind: "select" };
type DragPayload = { kind: "new"; type: string; team: string } | { kind: "move"; index: number };

function SetupEditor() {
  const { variant, testSetup, dispatch, setSection, setSimulationSource, notify } = useEditor();
  const theme = getBoardTheme(variant.theme.boardTheme);
  const [brush, setBrush] = useState<Brush>({ kind: "select" });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [fen, setFen] = useState("");
  const [flipped, setFlipped] = useState(false);
  const pieces = testSetup.pieces;
  const selected = selectedIndex !== null ? pieces[selectedIndex] : undefined;

  const commit = (setup: PositionSetup, coalesceKey?: string) => dispatch({ type: "setTestSetup", setup, coalesceKey });
  const withPieces = (next: PlacedPiece[]) => commit({ ...testSetup, pieces: next });
  const indexAt = (coord: Coord) => pieces.findIndex((piece) => sameCoord(piece, coord));

  function place(coord: Coord, type: string, team: string) {
    if (!isPlayable(variant.board, coord)) return notify(`${squareName(coord)}: ${ui("not playable")}`, "error");
    const next = pieces.filter((piece) => !sameCoord(piece, coord));
    next.push({ type, team, x: coord.x, y: coord.y });
    withPieces(next);
    setSelectedIndex(next.length - 1);
  }

  function handleDrop(coord: Coord, payload: string, duplicate: boolean) {
    const data = JSON.parse(payload) as DragPayload;
    if (data.kind === "new") return place(coord, data.type, data.team);
    const source = pieces[data.index];
    if (!source || sameCoord(source, coord)) return;
    if (!isPlayable(variant.board, coord)) return notify(`${squareName(coord)}: ${ui("not playable")}`, "error");
    const moved: PlacedPiece = { ...source, x: coord.x, y: coord.y };
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
    const spot = variant.board.cells
      .filter((cell) => isPlayable(variant.board, cell) && indexAt(cell) < 0)
      .sort((a, b) => Math.max(Math.abs(a.x - selected.x), Math.abs(a.y - selected.y)) - Math.max(Math.abs(b.x - selected.x), Math.abs(b.y - selected.y)))[0];
    if (!spot) return notify(ui("No free square for a copy"), "error");
    withPieces([...pieces, { ...selected, x: spot.x, y: spot.y }]);
    setSelectedIndex(pieces.length);
  }

  const boardPieces = useMemo(() => pieces.map((piece, index) => ({ ...piece, key: String(index) })), [pieces]);
  const highlights = useMemo(() => new Map(selected ? [[`${selected.x},${selected.y}`, "selected" as const]] : []), [selected]);

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
            <p className={labelClass}>{team.name}</p>
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
                      title={`${team.name} ${def.name}${suggested ? ` — ${placed} of ${suggested} suggested placed` : ""}`}
                      aria-pressed={active}
                      onDragStart={(event) => event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind: "new", type: def.id, team: team.id } satisfies DragPayload))}
                      onClick={() => setBrush(active ? { kind: "select" } : { kind: "piece", type: def.id, team: team.id })}
                      className={`relative aspect-square rounded-lg border p-0.5 transition ${active ? "border-sky-400/70 bg-sky-400/15" : "border-white/[0.08] bg-black/30 hover:border-white/25"}`}
                    >
                      <PieceToken def={def} team={team} />
                      {suggested > 0 && (
                        <span className={`absolute bottom-0 right-0.5 text-[9px] font-bold ${placed === suggested ? "text-emerald-300" : placed > suggested ? "text-amber-300" : "text-zinc-500"}`}>
                          {placed}/{suggested}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
        <p className="text-[11px] leading-5 text-zinc-500">{ui("Alt/Option-drag a piece on the board to duplicate it. Right-click removes.")}</p>
      </Panel>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            tone="primary"
            onClick={() => {
              setSimulationSource("test");
              setSection("simulation2d");
            }}
          >
            <Play size={15} />
            {ui("Simulate in 2D")}
          </Button>
          <Button
            tone="blue"
            onClick={() => {
              setSimulationSource("test");
              setSection("simulation");
            }}
          >
            <Box size={15} />
            {ui("Simulate in 3D")}
          </Button>
          <span className="mx-1 h-6 w-px bg-white/10" />
          <Button size="sm" onClick={() => commit(structuredClone(variant.setup))} title={ui("Reset to the variant's starting position")}>
            <RotateCcw size={14} />
            {ui("Reset Position")}
          </Button>
          <Button size="sm" onClick={() => withPieces([])}>
            <Trash2 size={14} />
            {ui("Clear board")}
          </Button>
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
          <IconButton label={ui("Flip board")} active={flipped} onClick={() => setFlipped((value) => !value)}>
            <FlipVertical2 size={15} />
          </IconButton>
        </div>
        <div className="mx-auto max-w-[min(100%,calc(var(--app-height)-300px))]">
          <Board2D
            board={variant.board}
            variant={variant}
            theme={theme}
            pieces={boardPieces}
            highlights={highlights}
            flipped={flipped}
            label={ui("Test position editor")}
            onCellClick={(coord) => handleClick(coord)}
            onCellContextMenu={(coord) => {
              const index = indexAt(coord);
              if (index >= 0) withPieces(pieces.filter((_, position) => position !== index));
            }}
            onDropPayload={(coord, payload, event) => handleDrop(coord, payload, event.altKey)}
            onPieceDragStart={(piece, event) => {
              event.dataTransfer.effectAllowed = "copyMove";
              event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ kind: "move", index: Number(piece.key) } satisfies DragPayload));
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Panel title={selected ? `${variant.pieces.find((def) => def.id === selected.type)?.name ?? selected.type} · ${squareName(selected)}` : ui("Selected piece")}>
          {selected ? (
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
          )}
        </Panel>

        <Panel title={ui("Game state")}>
          <div className="space-y-3">
            <div>
              <p className={labelClass}>{ui("Side to move")}</p>
              <Select label="Side to move" className="mt-1.5" value={testSetup.startingTeam} onChange={(startingTeam) => commit({ ...testSetup, startingTeam })} options={variant.teams.map((team) => ({ id: team.id, label: team.name }))} />
            </div>
            <div>
              <p className={labelClass}>{ui("Move counter")}</p>
              <NumberField label="Move counter" value={testSetup.turnNumber} min={1} max={500} onChange={(turnNumber) => commit({ ...testSetup, turnNumber }, "turn-number")} />
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
                <input value={fen} onChange={(event) => setFen(event.target.value)} placeholder="rnbqkbnr/pppppppp/8/…" className={`${inputClass} py-1.5 font-mono text-xs`} />
                <Button size="sm" type="submit" disabled={!fen.trim()}>
                  {ui("Load")}
                </Button>
              </div>
            </form>
            <p className="text-xs text-zinc-500">
              {pieces.length} {ui("pieces placed")} · {variant.teams.map((team) => `${team.name} ${pieces.filter((piece) => piece.team === team.id).length}`).join(" · ")}
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function TestSection() {
  return (
    <div>
      <SectionHeading
        eyebrow="Test Position"
        title="Set up any position"
        description={ui("Build a position to try a rule without playing a whole game. Place several kings, custom pieces, anything — then simulate it in 2D or 3D.")}
      />
      <SetupEditor />
    </div>
  );
}
