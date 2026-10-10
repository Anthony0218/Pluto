import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { Copy, Crown, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ALL_DIRECTIONS, createExamplePieces, createId } from "@/games/chess/custom/engine/presets";
import {
  PIECE_ABILITIES,
  type PieceAbility,
  type PieceDefinition,
  type PieceModelAccent,
  type PieceModelBase,
} from "@/games/chess/custom/engine/types";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { paintSquare, type SquareBrush } from "@/games/chess/custom/editor/movementBrush";
import { ui } from "@/i18n/ui";
import MovementBrushPalette from "../MovementBrushPalette";
import MovementGrid from "../MovementGrid";
import PieceToken from "../PieceToken";
import RuleListEditor from "../RuleListEditor";
import { Button, Chip, EmptyState, Field, NumberField, Panel, SectionHeading, Segmented, Select, Toggle, inputClass, labelClass } from "../ui";

const GLYPHS = ["♚", "♛", "♜", "♝", "♞", "♟", "✦", "◆", "▲", "●", "★", "✚", "❖", "⬢", "✪", "⚡", "☽", "☀"];
const EMOJI = ["🧙", "💣", "🐉", "🛡️", "💥", "🦄", "🏹", "🐺", "👑", "🔥", "❄️", "🌀", "🦅", "🐍", "🗡️", "🏰", "🤖", "🐙"];
const MODEL_BASES: PieceModelBase[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
const ACCENTS: { id: PieceModelAccent; label: string }[] = [
  { id: "none", label: "None" },
  { id: "crown", label: "Crown" },
  { id: "orb", label: "Floating orb" },
  { id: "flame", label: "Flame" },
  { id: "shield", label: "Shield" },
  { id: "spike", label: "Spike" },
];
const ABILITY_INFO: Record<PieceAbility, { label: string; description: string }> = {
  castling: { label: "Castling", description: "May castle with an unmoved partner piece (needs the Castling rule)." },
  castlePartner: { label: "Castle partner", description: "Can be the partner in castling, like a rook." },
  enPassant: { label: "En passant", description: "May capture a piece that just double-stepped past it." },
  invulnerable: { label: "Invulnerable", description: "Can never be captured." },
  explosive: { label: "Explosive", description: "When captured, destroys its capturer and adjacent non-royal pieces." },
};

function uniqueId(base: string, taken: string[]) {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "piece";
  let id = slug;
  for (let n = 2; taken.includes(id); n++) id = `${slug}-${n}`;
  return id;
}

function newPiece(taken: string[]): PieceDefinition {
  return {
    id: uniqueId("new-piece", taken),
    name: "New Piece",
    symbol: "",
    icon: "✦",
    model: { base: "pawn", accent: "orb", tint: "#38bdf8" },
    description: "",
    value: 3,
    royal: false,
    movement: [{ id: createId("rule"), kind: "leap", offsets: ALL_DIRECTIONS.slice(), canJump: true, relativeTo: "board" }],
    capture: [],
    captureSameAsMove: true,
    abilities: [],
    spawnAmount: 1,
  };
}

function PieceEditor({ piece }: { piece: PieceDefinition }) {
  useGameLanguage();
  const { variant, dispatch, setSelectedPieceId } = useEditor();
  const [activeRuleId, setActiveRuleId] = useState<string | undefined>();
  const [brush, setBrush] = useState<SquareBrush>("both");
  const [movementView, setMovementView] = useState<"2d" | "3d">("2d");
  const [lastPiece, setLastPiece] = useState(piece.id);
  if (lastPiece !== piece.id) {
    setLastPiece(piece.id);
    setActiveRuleId(undefined);
  }

  const update = (recipe: (piece: PieceDefinition) => PieceDefinition, coalesceKey?: string) =>
    dispatch({ type: "updatePieceDefinition", id: piece.id, recipe, coalesceKey: coalesceKey && `${piece.id}-${coalesceKey}` });
  const patch = (value: Partial<PieceDefinition>, coalesceKey?: string) => update((current) => ({ ...current, ...value }), coalesceKey);
  const team = variant.teams[0];
  const placed = variant.setup.pieces.filter((entry) => entry.type === piece.id).length;

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-5">
        <Panel
          title={ui("Identity")}
          actions={
            <>
              <Button size="sm" onClick={() => {
                const copy = { ...structuredClone(piece), id: uniqueId(`${piece.name} copy`, variant.pieces.map((entry) => entry.id)), name: `${piece.name} Copy`, royal: false };
                dispatch({ type: "addPieceDefinition", piece: copy });
                setSelectedPieceId(copy.id);
              }}>
                <Copy size={13} />
                {ui("Clone")}
              </Button>
              <Button size="sm" tone="danger" onClick={() => {
                dispatch({ type: "removePieceDefinition", id: piece.id });
                setSelectedPieceId(null);
              }} title={placed ? `${ui("Also removes its pieces from the starting position:")} ${placed}` : undefined}>
                <Trash2 size={13} />
                {ui("Delete")}
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label={ui("Display name")}>
              <input value={piece.name} maxLength={40} onChange={(event) => patch({ name: event.target.value }, "name")} className={inputClass} />
            </Field>
            <Field label={ui("Notation")} hint={ui("e.g. N, Wz")}>
              <input value={piece.symbol} maxLength={3} onChange={(event) => patch({ symbol: event.target.value.replace(/\s/g, "") }, "symbol")} className={inputClass} />
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">{ui("Internal id")}: <code className="text-zinc-400">{piece.id}</code></p>
          <div className="mt-4">
            <p className={labelClass}>{ui("Icon")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[...GLYPHS, ...EMOJI].map((icon) => (
                <button
                  key={icon}
                  type="button"
                  aria-label={gameUi(`Icon ${icon}`)}
                  aria-pressed={piece.icon === icon}
                  onClick={() => patch({ icon })}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-lg transition ${piece.icon === icon ? "border-amber-300/70 bg-amber-300/15" : "border-white/[0.08] bg-white/[0.03] hover:border-white/20"}`}
                >
                  {gameUi(icon)}
                </button>
              ))}
              <input aria-label={ui("Custom icon")} value={GLYPHS.includes(piece.icon) || EMOJI.includes(piece.icon) ? "" : piece.icon} placeholder="…" maxLength={4} onChange={(event) => event.target.value && patch({ icon: event.target.value }, "icon")} className="h-8 w-14 rounded-lg border border-white/10 bg-black/40 px-2 text-center text-sm text-zinc-100 outline-none focus:border-amber-300/50" />
            </div>
          </div>
          <div className="mt-4">
            <Field label={ui("Description")}>
              <textarea value={piece.description ?? ""} rows={2} maxLength={300} onChange={(event) => patch({ description: event.target.value }, "description")} className={`${inputClass} resize-y`} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-5">
            <div>
              <p className={labelClass}>{ui("Value")}</p>
              <NumberField label={gameUi("Value")} value={piece.value} min={0} max={100} step={0.5} onChange={(value) => patch({ value }, "value")} />
            </div>
            <div>
              <p className={labelClass} title={ui("Suggested copies per team — shown as a counter in the Test Position palette")}>{ui("Spawn amount")}</p>
              <NumberField label={gameUi("Spawn amount")} value={piece.spawnAmount ?? 1} min={0} max={16} onChange={(spawnAmount) => patch({ spawnAmount }, "spawn")} />
            </div>
            <div className="min-w-[180px] flex-1">
              <p className={labelClass}>{ui("Team")}</p>
              <Select
                label={gameUi("Team")}
                value={piece.teams?.length === 1 ? piece.teams[0] : "all"}
                onChange={(value) => patch({ teams: value === "all" ? undefined : [value] })}
                options={[{ id: "all", label: "Both teams" }, ...variant.teams.map((entry) => ({ id: entry.id, label: `${entry.name} only` }))]}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="mt-4">
            <Toggle checked={piece.royal} onChange={(royal) => patch({ royal })} label={<span className="inline-flex items-center gap-1.5"><Crown size={14} className="text-amber-300" />{ui("Royal piece")}</span>} description={ui("Protected by the King rules: check, checkmate and king-capture events apply to it.")} />
          </div>
        </Panel>

        <Panel title={ui("3D model")} eyebrow={ui("Simulation appearance")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={ui("Base model")}>
              <Select label={gameUi("Base model")} value={piece.model.base} onChange={(base) => patch({ model: { ...piece.model, base } })} options={MODEL_BASES.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }))} />
            </Field>
            <Field label={ui("Accent")}>
              <Select label={gameUi("Accent")} value={piece.model.accent ?? "none"} onChange={(accent) => patch({ model: { ...piece.model, accent } })} options={ACCENTS} />
            </Field>
            <Field label={ui("Accent colour")}>
              <input type="color" value={piece.model.tint ?? "#fbbf24"} onChange={(event) => patch({ model: { ...piece.model, tint: event.target.value } }, "tint")} className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-black/40 p-1" />
            </Field>
            <Field label={gameUi(`${ui("Scale")} · ${(piece.model.scale ?? 1).toFixed(2)}×`)}>
              <input type="range" min={0.7} max={1.3} step={0.05} value={piece.model.scale ?? 1} onChange={(event) => patch({ model: { ...piece.model, scale: Number(event.target.value) } }, "scale")} className="w-full accent-amber-300" />
            </Field>
          </div>
        </Panel>

        <Panel title={ui("Abilities")}>
          <div className="space-y-3">
            {PIECE_ABILITIES.map((ability) => (
              <Toggle
                key={ability}
                checked={piece.abilities.includes(ability)}
                onChange={(on) => patch({ abilities: on ? [...piece.abilities, ability] : piece.abilities.filter((entry) => entry !== ability) })}
                label={ui(ABILITY_INFO[ability].label)}
                description={ui(ABILITY_INFO[ability].description)}
              />
            ))}
          </div>
        </Panel>

        <Panel title={ui("Promotion")}>
          <Toggle
            checked={Boolean(piece.promotion)}
            onChange={(on) => patch({ promotion: on ? { zone: "farRank", options: variant.pieces.filter((entry) => !entry.royal && entry.id !== piece.id).slice(0, 4).map((entry) => entry.id) } : undefined })}
            label={ui("Can promote")}
            description={ui("Transforms into another piece when it reaches the promotion zone.")}
          />
          {piece.promotion && (
            <div className="mt-4 space-y-3">
              <Segmented
                size="sm"
                label={gameUi("Promotion zone")}
                value={piece.promotion.zone}
                onChange={(zone) => patch({ promotion: { ...piece.promotion!, zone } })}
                options={[
                  { id: "farRank", label: "Far rank" },
                  { id: "tiles", label: "Promotion tiles" },
                  { id: "both", label: "Either" },
                ]}
              />
              <div className="flex flex-wrap gap-1.5">
                {variant.pieces.filter((entry) => entry.id !== piece.id).map((entry) => {
                  const on = piece.promotion!.options.includes(entry.id);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => patch({ promotion: { ...piece.promotion!, options: on ? piece.promotion!.options.filter((option) => option !== entry.id) : [...piece.promotion!.options, entry.id] } })}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition ${on ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-400 hover:text-white"}`}
                    >
                      <span className="h-5 w-5"><PieceToken def={entry} team={team} /></span>
                      {gameUi(entry.name)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="order-first space-y-5 2xl:order-none">
        <Panel title={ui("Movement")} eyebrow={ui("Pick a brush, then click squares")}>
          <MovementBrushPalette value={brush} onChange={setBrush} />
          <div className="mt-3 flex gap-2"><Button size="sm" tone={movementView === "2d" ? "blue" : "ghost"} onClick={() => setMovementView("2d")}>2D</Button><Button size="sm" tone={movementView === "3d" ? "blue" : "ghost"} onClick={() => setMovementView("3d")}>3D</Button></div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-1">
            <div className="mx-auto w-full max-w-[380px]">
              {(movementView === "3d" ? [{ z: 1, name: "Layer Above" }, { z: 0, name: "Current Layer" }, { z: -1, name: "Layer Below" }] : [{ z: 0, name: "Current Layer" }]).map((layer) => <div key={layer.z} className="mb-4"><p className="mb-2 text-xs font-semibold text-amber-200">{gameUi(layer.name)}</p><MovementGrid
                piece={piece}
                team={team}
                moveRules={piece.movement}
                captureRules={piece.captureSameAsMove ? piece.movement : piece.capture}
                activeRuleId={activeRuleId}
                layerDelta={layer.z}
                radius={movementView === "3d" ? 2 : undefined}
                onToggle={(offset) => update((current) => paintSquare(current, offset, brush))}
              /></div>)}
            </div>
            <div>
              <p className={`${labelClass} mb-2`}>{ui("Patterns · advanced settings")}</p>
              <RuleListEditor piece={piece} onChange={(next, coalesceKey) => update(() => next, coalesceKey)} activeRuleId={activeRuleId} onActivate={(id) => setActiveRuleId(id === activeRuleId ? undefined : id)} />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function PiecesSection() {
  useGameLanguage();
  const { variant, dispatch, selectedPieceId, setSelectedPieceId } = useEditor();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const selected = variant.pieces.find((piece) => piece.id === selectedPieceId) ?? null;
  const examples = createExamplePieces().filter((example) => !variant.pieces.some((piece) => piece.id === example.id));
  const team = variant.teams[0];

  useEffect(() => {
    if (!selectedPieceId && variant.pieces[0]) setSelectedPieceId(variant.pieces[0].id);
  }, [selectedPieceId, variant.pieces, setSelectedPieceId]);

  function add(piece: PieceDefinition) {
    dispatch({ type: "addPieceDefinition", piece });
    setSelectedPieceId(piece.id);
  }

  return (
    <div>
      <SectionHeading
        step="pieces"
        eyebrow="Pieces"
        title={gameUi("Design your army")}
        description={ui("Every piece — standard or invented — is defined by movement patterns, capture patterns and abilities. Clone a classic and bend it, or start from scratch.")}
      />
      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button tone="primary" size="sm" className="flex-1" onClick={() => add(newPiece(variant.pieces.map((piece) => piece.id)))}>
              <Plus size={14} />
              {ui("New piece")}
            </Button>
            <div className="relative flex-1">
              <Button size="sm" className="w-full" disabled={!examples.length} onClick={() => setExamplesOpen((open) => !open)} title={gameUi(examples.length ? undefined : ui("Every example piece is already in this variant"))}>
                <Sparkles size={14} />
                {ui("Examples")}
              </Button>
              {gameUi(examplesOpen && (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-white/10 bg-[#111418] p-1 shadow-2xl">
                  {examples.map((example) => (
                    <button
                      key={example.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        add(example);
                        setExamplesOpen(false);
                      }}
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/[0.06]"
                    >
                      <span className="h-7 w-7 shrink-0"><PieceToken def={example} team={team} /></span>
                      <span>
                        <span className="block text-sm font-semibold text-zinc-100">{gameUi(example.name)}</span>
                        <span className="line-clamp-2 block text-[11px] leading-4 text-zinc-500">{gameUi(example.description)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1" aria-label={ui("Piece library")}>
            {variant.pieces.map((piece) => {
              const active = piece.id === selected?.id;
              return (
                <li key={piece.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedPieceId(piece.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${active ? "border-amber-300/50 bg-amber-300/[0.08]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"}`}
                  >
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-black/30 p-0.5"><PieceToken def={piece} team={team} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-100">
                        {piece.name}
                        {piece.royal && <Crown size={12} className="shrink-0 text-amber-300" aria-label={gameUi("Royal")} />}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-500">
                        {ui("Value")} {gameUi(piece.value)} · {gameUi(piece.movement.length)} {ui("patterns")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="amber">{gameUi(variant.pieces.filter((piece) => piece.royal).length)} {ui("royal")}</Chip>
            <Chip>{gameUi(variant.pieces.length)} {ui("types")}</Chip>
          </div>
        </div>
        {gameUi(selected ? (
          <PieceEditor piece={selected} />
        ) : (
          <EmptyState icon={<Crown size={20} />} title={ui("No piece selected")} action={<Button tone="primary" onClick={() => add(newPiece([]))}>{ui("Create a piece")}</Button>}>
            {ui("Pick a piece from the library, or create a new one.")}
          </EmptyState>
        ))}
      </div>
    </div>
  );
}
