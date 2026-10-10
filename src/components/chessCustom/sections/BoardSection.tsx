import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Link2, MousePointer2, SquareDashed } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BOARD_SHAPE_LABELS,
  BOARD_SHAPES,
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  applyBoardShape,
  boardLayers,
  createRectangularBoard,
  getCell,
  getLayer,
  replaceLayer,
  resizeBoard,
  sameCoord,
  setTile,
  squareName,
  updateCell,
} from "@/games/chess/custom/engine/board";
import { TILE_TYPES, type BoardDefinition, type Coord, type TileType } from "@/games/chess/custom/engine/types";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { getBoardTheme, TILE_STYLES } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";
import { coordKey } from "@/games/chess/custom/editor/editorUtils";
import Board2D, { type CellHighlight } from "../Board2D";
import { Button, NumberField, Panel, SectionHeading, Select, Toggle, labelClass } from "../ui";

type Tool = { kind: "select" } | { kind: "toggle" } | { kind: "tile"; tile: TileType };

const SIZE_PRESETS: [number, number][] = [[8, 8], [10, 8], [10, 10], [12, 12]];

export default function BoardSection() {
  useGameLanguage();
  const { variant, dispatch, focusTarget } = useEditor();
  const [activeLayer, setActiveLayer] = useState(0);
  const layers = boardLayers(variant.board);
  const board = getLayer(variant.board, activeLayer) ?? variant.board;
  const theme = getBoardTheme(variant.theme.boardTheme);
  const focusedCell = focusTarget && /^\d+,\d+$/.test(focusTarget) ? focusTarget : null;
  const toCoord = (key: string): Coord => {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  };
  const [tool, setTool] = useState<Tool>(focusedCell ? { kind: "select" } : { kind: "toggle" });
  const [selected, setSelected] = useState<Coord | null>(focusedCell ? toCoord(focusedCell) : null);
  const [seenFocus, setSeenFocus] = useState(focusedCell);
  // A validation issue can point at a cell: select it for inspection.
  if (focusedCell !== seenFocus) {
    setSeenFocus(focusedCell);
    if (focusedCell) {
      setSelected(toCoord(focusedCell));
      setTool({ kind: "select" });
    }
  }
  const [linkFrom, setLinkFrom] = useState<Coord | null>(null);
  const [twoWay, setTwoWay] = useState(true);
  const painting = useRef<{ key: string; enabled?: boolean } | null>(null);

  useEffect(() => {
    const stop = () => (painting.current = null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const updateBoard = (next: BoardDefinition, coalesceKey?: string) => dispatch({ type: "update", recipe: (current) => ({ ...current, board: replaceLayer(current.board, activeLayer, next) }), coalesceKey });
  const resizeLayer = (width: number, height: number) => updateBoard(resizeBoard(board, width, height), "resize-layer");
  const updateLayers = (recipe: (current: BoardDefinition) => BoardDefinition) => dispatch({ type: "update", recipe: (current) => ({ ...current, board: recipe(current.board) }) });
  const selectedCell = selected ? getCell(board, selected) : null;

  /** Paint strokes read the latest board through a recipe, so fast drags never drop cells. */
  function paint(coord: Coord) {
    const cell = getCell(board, coord);
    const stroke = painting.current;
    if (!cell || !stroke) return;
    if (tool.kind === "toggle") {
      stroke.enabled ??= !cell.enabled;
      const enabled = stroke.enabled;
      dispatch({
        type: "update",
        coalesceKey: stroke.key,
        recipe: (current) => ({
          ...current,
          board: getCell(current.board, { ...coord, z: activeLayer })?.enabled === enabled ? current.board : updateCell(current.board, { ...coord, z: activeLayer }, enabled ? { enabled: true } : { enabled: false, tile: "normal", portalTarget: undefined }),
        }),
      });
    } else if (tool.kind === "tile" && tool.tile !== "portal") {
      const tile = tool.tile;
      dispatch({ type: "update", coalesceKey: stroke.key, recipe: (current) => ({ ...current, board: getCell(current.board, { ...coord, z: activeLayer })?.tile === tile ? current.board : setTile(current.board, { ...coord, z: activeLayer }, tile) }) });
    }
  }

  function handleClick(coord: Coord) {
    setSelected(coord);
    if (tool.kind !== "tile" || tool.tile !== "portal") return;
    const global = { ...coord, z: activeLayer };
    if (!linkFrom) {
      dispatch({ type: "update", recipe: (current) => ({ ...current, board: setTile(current.board, global, "portal") }) });
      setLinkFrom(global);
      return;
    }
    if (sameCoord(linkFrom, global)) return setLinkFrom(null);
    let next = updateCell(variant.board, linkFrom, { portalTarget: global });
    if (twoWay) next = updateCell(setTile(next, global, "portal"), global, { portalTarget: linkFrom });
    dispatch({ type: "updateBoard", board: next });
    setLinkFrom(null);
  }

  const highlights = useMemo(() => {
    const map = new Map<string, CellHighlight>();
    for (const cell of board.cells) {
      if (cell.tile === "portal" && cell.portalTarget && selected && sameCoord(cell, selected)) map.set(coordKey(cell.portalTarget), "target");
    }
    if (selected) map.set(coordKey(selected), "selected");
    if (linkFrom) map.set(coordKey(linkFrom), "special");
    return map;
  }, [board.cells, selected, linkFrom]);

  const setupPieces = useMemo(() => variant.setup.pieces.filter((piece) => (piece.z ?? 0) === activeLayer).map((piece, index) => ({ ...piece, key: String(index) })), [variant.setup.pieces, activeLayer]);

  const toolButton = (active: boolean, label: string, onClick: () => void, swatch: ReactNode, title?: string) => (
    <button
      key={label}
      type="button"
      aria-pressed={active}
      title={ui(title ?? label)}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition ${active ? "border-sky-400/60 bg-sky-400/15 text-sky-50" : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/20"}`}
    >
      {gameUi(swatch)}
      <span className="truncate">{ui(label)}</span>
    </button>
  );

  const hint =
    tool.kind === "toggle"
      ? ui("Click or drag across cells to add or remove them from the board.")
      : tool.kind === "select"
        ? ui("Click a cell to inspect and fine-tune it.")
        : tool.tile === "portal"
          ? linkFrom
            ? `${ui("Now click the portal's destination (click the portal again to cancel):")} ${squareName(linkFrom)}`
            : ui("Click a cell to place a portal, then click its destination.")
          : `${ui("Click or drag to paint tiles:")} ${ui(TILE_STYLES[tool.tile].label)}. ${ui(TILE_STYLES[tool.tile].description)}`;

  return (
    <div>
      <SectionHeading
        step="board"
        eyebrow="Board"
        title={gameUi("Shape the battlefield")}
        description={ui("Resize the board, carve out any shape, stack layers and paint special tiles. Pieces standing on removed cells are ignored when the game starts. Board colours and piece finishes live in Simulation → Settings.")}
      />
      <Panel title={gameUi("Board layers")} eyebrow={`${layers.length} layer${layers.length === 1 ? "" : "s"}`}>
        <div className="flex flex-wrap gap-2">
          {layers.map((layer) => <button key={layer.id} type="button" aria-pressed={activeLayer === layer.z} onClick={() => { setActiveLayer(layer.z); setSelected(null); }} className={`rounded-xl border px-3 py-2 text-left text-xs ${activeLayer === layer.z ? "border-sky-400 bg-sky-400/15 text-white" : "border-white/10 text-zinc-400"}`}><span className="block font-semibold">{gameUi(layer.name)}</span><span>{gameUi(layer.width)}×{gameUi(layer.height)} · z={gameUi(layer.z)}</span></button>)}
          {layers.length < 8 && <Button size="sm" onClick={() => {
            const z = Math.max(...layers.map((layer) => layer.z)) + 1;
            updateLayers((current) => ({ ...current, layers: [...(current.layers ?? []), { ...createRectangularBoard(current.width, current.height), id: `layer-${Date.now()}`, name: `Layer ${z + 1}`, z }] }));
            setActiveLayer(z);
          }}>{gameUi("+ Add Layer")}</Button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-zinc-400">{gameUi("Name ")}<input value={layers.find((layer) => layer.z === activeLayer)?.name ?? "Ground"} onChange={(event) => {
            const name = event.target.value;
            updateLayers((current) => activeLayer === 0 ? { ...current, name } : { ...current, layers: current.layers?.map((layer) => layer.z === activeLayer ? { ...layer, name } : layer) });
          }} className="ml-1 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-white" /></label>
          <Button size="sm" onClick={() => {
            const z = Math.max(...layers.map((layer) => layer.z)) + 1;
            if (layers.length >= 8) return;
            updateLayers((current) => ({ ...current, layers: [...(current.layers ?? []), { width: board.width, height: board.height, id: `layer-${Date.now()}`, name: `${layers.find((layer) => layer.z === activeLayer)?.name ?? "Ground"} Copy`, z, cells: board.cells.map((cell) => ({ ...cell, portalTarget: undefined, tile: cell.tile === "portal" ? "normal" : cell.tile })) }] }));
            setActiveLayer(z);
          }}>{gameUi("Duplicate")}</Button>
          <Button size="sm" onClick={() => updateBoard({ ...board, cells: board.cells.map((cell) => ({ ...cell, x: board.width - 1 - cell.x, portalTarget: cell.portalTarget && (cell.portalTarget.z ?? activeLayer) === activeLayer ? { ...cell.portalTarget, x: board.width - 1 - cell.portalTarget.x } : cell.portalTarget })).sort((a, b) => a.y - b.y || a.x - b.x) })}>{gameUi("Mirror")}</Button>
          <Button size="sm" onClick={() => updateBoard(createRectangularBoard(board.width, board.height))}>{gameUi("Clear Layer")}</Button>
          {activeLayer > 0 && <>
            <Button size="sm" disabled={layers.findIndex((layer) => layer.z === activeLayer) <= 1} onClick={() => {
              const index = layers.findIndex((layer) => layer.z === activeLayer);
              const nextZ = layers[index - 1].z;
              dispatch({ type: "swapLayers", a: activeLayer, b: nextZ });
              setActiveLayer(nextZ);
            }}>{gameUi("Move Down")}</Button>
            <Button size="sm" disabled={layers.findIndex((layer) => layer.z === activeLayer) >= layers.length - 1} onClick={() => {
              const index = layers.findIndex((layer) => layer.z === activeLayer);
              const nextZ = layers[index + 1].z;
              dispatch({ type: "swapLayers", a: activeLayer, b: nextZ });
              setActiveLayer(nextZ);
            }}>{gameUi("Move Up")}</Button>
          </>}
          {activeLayer > 0 && <Button size="sm" tone="danger" onClick={() => {
            dispatch({ type: "deleteLayer", z: activeLayer });
            setActiveLayer(0);
          }}>{gameUi("Delete Layer")}</Button>}
        </div>
      </Panel>
      <div className="grid gap-5 2xl:grid-cols-[260px_minmax(0,1fr)_300px] xl:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title={ui("Size")}>
            <div className="grid grid-cols-2 gap-2">
              {SIZE_PRESETS.map(([width, height]) => (
                <Button key={`${width}x${height}`} size="sm" tone={board.width === width && board.height === height ? "blue" : "ghost"} onClick={() => resizeLayer(width, height)}>
                  {gameUi(width)}×{gameUi(height)}
                </Button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div>
                <p className={labelClass}>{ui("Width")}</p>
                <NumberField label={gameUi("Width")} value={board.width} min={MIN_BOARD_SIZE} max={MAX_BOARD_SIZE} onChange={(width) => resizeLayer(width, board.height)} />
              </div>
              <div>
                <p className={labelClass}>{ui("Height")}</p>
                <NumberField label={gameUi("Height")} value={board.height} min={MIN_BOARD_SIZE} max={MAX_BOARD_SIZE} onChange={(height) => resizeLayer(board.width, height)} />
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">{ui("Maximum size, to keep the 3D simulation smooth:")} {gameUi(MAX_BOARD_SIZE)}×{gameUi(MAX_BOARD_SIZE)}</p>
          </Panel>

          <Panel title={ui("Shape templates")}>
            <div className="grid grid-cols-2 gap-2">
              {BOARD_SHAPES.map((shape) => (
                <Button key={shape} size="sm" onClick={() => updateBoard(applyBoardShape(board, shape))}>
                  {ui(BOARD_SHAPE_LABELS[shape])}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{ui("Templates keep both home ranks so a standard army still fits. Undo reverts instantly.")}</p>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel padded={false}>
            <div className="flex flex-wrap gap-1.5 border-b border-white/[0.06] p-3">
              {gameUi(toolButton(tool.kind === "select", "Inspect", () => setTool({ kind: "select" }), <MousePointer2 size={14} />))}
              {gameUi(toolButton(tool.kind === "toggle", "Add / remove cells", () => setTool({ kind: "toggle" }), <SquareDashed size={14} />))}
              {TILE_TYPES.map((tile) =>
                toolButton(
                  tool.kind === "tile" && tool.tile === tile,
                  TILE_STYLES[tile].label,
                  () => {
                    setTool({ kind: "tile", tile });
                    setLinkFrom(null);
                  },
                  <span className="flex h-4 w-4 items-center justify-center rounded text-[10px]" style={{ background: tile === "normal" ? theme.light : `${TILE_STYLES[tile].color}40`, boxShadow: `inset 0 0 0 1.5px ${tile === "normal" ? theme.dark : TILE_STYLES[tile].color}`, color: TILE_STYLES[tile].color }}>
                    {gameUi(TILE_STYLES[tile].glyph)}
                  </span>,
                  TILE_STYLES[tile].description,
                ),
              )}
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs text-zinc-400">
              <p aria-live="polite">{gameUi(hint)}</p>
              {gameUi(tool.kind === "tile" && tool.tile === "portal" && (
                <label className="flex shrink-0 items-center gap-2">
                  <input type="checkbox" checked={twoWay} onChange={(event) => setTwoWay(event.target.checked)} className="accent-amber-300" />
                  {ui("Two-way")}
                </label>
              ))}
            </div>
            <div className="mx-auto max-w-[min(100%,calc(var(--app-height)-300px))] p-4 pt-1" onPointerLeave={() => (painting.current = null)}>
              <Board2D
                board={board}
                variant={variant}
                theme={theme}
                pieces={setupPieces}
                highlights={highlights}
                showDisabled
                label={ui("Board editor")}
                onCellClick={(coord) => handleClick(coord)}
                onCellPointerDown={(coord, event) => {
                  if (event.button !== 0 || tool.kind === "select") return;
                  painting.current = { key: `paint-${Date.now()}` };
                  paint(coord);
                }}
                onCellPointerEnter={(coord, event) => {
                  if (event.buttons === 1) paint(coord);
                }}
                cellBadge={(cell) =>
                  cell.tile === "portal" && cell.portalTarget ? (
                    <span className="pointer-events-none absolute bottom-[4%] left-1/2 z-10 -translate-x-1/2 rounded bg-black/70 px-1 text-[min(1.5vw,9px)] font-bold text-violet-200">→{gameUi(squareName(cell.portalTarget))}</span>
                  ) : null
                }
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:col-span-2 2xl:col-span-1">
          <Panel title={gameUi(selectedCell ? `${ui("Cell")} ${squareName(selectedCell)}` : ui("Cell inspector"))}>
            {gameUi(!selectedCell ? (
              <p className="text-sm text-zinc-500">{ui("Select a cell (Inspect tool) to edit its properties.")}</p>
            ) : (
              <div className="space-y-4">
                <Toggle
                  checked={selectedCell.enabled}
                  onChange={(enabled) => updateBoard(updateCell(board, selectedCell, enabled ? { enabled } : { enabled, tile: "normal", portalTarget: undefined }))}
                  label={ui("Part of the board")}
                  description={ui("Disabled cells do not exist: nothing may stand on or pass through them.")}
                />
                <div>
                  <p className={labelClass}>{ui("Tile type")}</p>
                  <Select
                    label={gameUi("Tile type")}
                    value={selectedCell.tile}
                    onChange={(tile) => updateBoard(setTile(board, selectedCell, tile))}
                    options={TILE_TYPES.map((tile) => ({ id: tile, label: TILE_STYLES[tile].label }))}
                    className="mt-1.5"
                  />
                  <p className="mt-1.5 text-xs leading-5 text-zinc-500">{ui(TILE_STYLES[selectedCell.tile].description)}</p>
                </div>
                {gameUi(["promotion", "goal", "spawn"].includes(selectedCell.tile) && (
                  <div>
                    <p className={labelClass}>{ui("Belongs to")}</p>
                    <Select
                      label={gameUi("Tile team")}
                      value={selectedCell.team ?? "any"}
                      onChange={(team) => updateBoard(updateCell(board, selectedCell, { team: team === "any" ? undefined : team }))}
                      options={[{ id: "any", label: "Every team" }, ...variant.teams.map((team) => ({ id: team.id, label: team.name }))]}
                      className="mt-1.5"
                    />
                  </div>
                ))}
                {gameUi(selectedCell.tile === "oneWay" && (
                  <div>
                    <p className={labelClass}>{ui("Allowed direction")}</p>
                    <div className="mt-1.5 flex gap-1.5">
                      {[
                        { direction: { x: 0, y: 1 }, icon: ArrowUp, label: "Up (towards Black)" },
                        { direction: { x: 0, y: -1 }, icon: ArrowDown, label: "Down (towards White)" },
                        { direction: { x: -1, y: 0 }, icon: ArrowLeft, label: "Left" },
                        { direction: { x: 1, y: 0 }, icon: ArrowRight, label: "Right" },
                      ].map(({ direction, icon: Icon, label }) => (
                        <button
                          key={label}
                          type="button"
                          title={gameUi(label)}
                          aria-pressed={sameCoord(selectedCell.direction, direction)}
                          onClick={() => updateBoard(updateCell(board, selectedCell, { direction }))}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg border ${sameCoord(selectedCell.direction, direction) ? "border-sky-400/60 bg-sky-400/15 text-sky-100" : "border-white/10 text-zinc-400 hover:text-white"}`}
                        >
                          <Icon size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {gameUi(selectedCell.tile === "portal" && (
                  <div>
                    <p className={labelClass}>{ui("Destination")}</p>
                    <p className="mt-1.5 text-sm text-zinc-200">{gameUi(selectedCell.portalTarget ? squareName(selectedCell.portalTarget) : <span className="text-red-300">{ui("Not linked yet")}</span>)}</p>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setTool({ kind: "tile", tile: "portal" });
                        setLinkFrom(selectedCell);
                      }}
                    >
                      <Link2 size={14} />
                      {ui("Pick destination on board")}
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </Panel>

        </div>
      </div>
    </div>
  );
}
