import { useMemo, useRef, useState } from "react";
import { isPlayable } from "@/games/chess/custom/engine/board";
import { createVariantFromPreset, KING_BEHAVIORS, matchKingBehavior, PRESETS, type PresetId } from "@/games/chess/custom/engine/presets";
import { VICTORY_LABELS } from "@/games/chess/custom/engine/victory";
import { buildVariantPreview } from "@/games/chess/custom/library/preview";
import type { CreateStep } from "@/games/chess/custom/library/navigation";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { getBoardTheme } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";
import Board2D from "../Board2D";
import BoardThumbnail from "../BoardThumbnail";
import ShareDialog from "../dialogs/ShareDialog";
import { ExportIcon, ImportIcon, LayersIcon, NextIcon, PrivateIcon, PublicIcon, ShareIcon } from "../icons/ChessCustomIcons";
import { STEP_ICONS } from "../icons/stepIcons";
import { Button, Chip, Panel, SectionHeading, inputClass, labelClass } from "../ui";
import ValidationPanel from "../ValidationPanel";

const FEATURED: PresetId[] = ["standard", "3d-chess", "portal", "sandbox"];

export default function OverviewSection() {
  const { variant, dispatch, goToStep, issues, exportJson, importJson, applyBasePreset, inLibrary, dirty, library, published, userId, save } = useEditor();
  const [importMessage, setImportMessage] = useState<{ tone: "error" | "warning"; lines: string[] } | null>(null);
  const [confirmPreset, setConfirmPreset] = useState<PresetId | null>(null);
  const [allPresets, setAllPresets] = useState(false);
  const [sharing, setSharing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const theme = getBoardTheme(variant.theme.boardTheme);
  const layers = 1 + (variant.board.layers?.length ?? 0);
  const playable = variant.board.cells.filter((cell) => isPlayable(variant.board, cell)).length;
  const special = variant.board.cells.filter((cell) => cell.enabled && cell.tile !== "normal").length;
  const behavior = KING_BEHAVIORS.find((entry) => entry.id === matchKingBehavior(variant.settings));
  const winConditions = variant.victoryConditions.filter((condition) => condition.enabled && condition.type !== "eventOutcome");
  const customPieces = variant.pieces.filter((piece) => !["pawn", "knight", "bishop", "rook", "queen", "king"].includes(piece.id)).length;
  const isPublic = Boolean(published[variant.id]);
  const entry = library.find((item) => item.id === variant.id) ?? null;
  const presetPreviews = useMemo(() => Object.fromEntries(PRESETS.map((preset) => [preset.id, buildVariantPreview(createVariantFromPreset(preset.id, 7))])), []);
  const presets = allPresets ? PRESETS : PRESETS.filter((preset) => FEATURED.includes(preset.id));

  const stats: { label: string; value: string; detail: string; step: CreateStep }[] = [
    { label: "Board", value: `${variant.board.width}×${variant.board.height}`, detail: `${playable} ${ui("playable")} · ${special} ${ui("special tiles")}`, step: "board" },
    { label: "Layers", value: String(layers), detail: layers > 1 ? ui("Multi-layer 3D board") : ui("Single board"), step: "board" },
    { label: "Pieces", value: String(variant.pieces.length), detail: `${customPieces} ${ui("custom")} · ${variant.setup.pieces.length} ${ui("on the board")}`, step: "pieces" },
    { label: "King behaviour", value: ui(behavior?.label ?? "Custom"), detail: ui(variant.settings.royalMode === "checkmate" ? "Check is enforced" : variant.settings.royalMode === "capture" ? "Kings can be captured" : "No royal pieces"), step: "rules" },
    { label: "Victory rules", value: String(winConditions.length), detail: winConditions.map((condition) => ui(VICTORY_LABELS[condition.type])).join(" · ") || ui("None yet"), step: "victory" },
    { label: "Events", value: String(variant.events.length), detail: `${variant.events.filter((event) => event.enabled).length} ${ui("enabled")}`, step: "events" },
  ];

  async function handleImport(file: File) {
    const result = importJson(await file.text());
    if (result.errors.length) setImportMessage({ tone: "error", lines: result.errors });
    else setImportMessage(result.warnings.length ? { tone: "warning", lines: result.warnings } : null);
  }

  function choosePreset(id: PresetId) {
    // Replacing a saved or edited variant's gameplay asks first (it stays undoable either way).
    if ((inLibrary || dirty) && confirmPreset !== id) return setConfirmPreset(id);
    setConfirmPreset(null);
    applyBasePreset(id);
  }

  return (
    <div>
      <SectionHeading
        step="overview"
        eyebrow="Overview"
        title="Start your chess variant"
        description={ui("Name it, pick a base to start from, then work through the steps. Every variant — standard chess included — is one configuration of the same rule engine.")}
        actions={
          <>
            <Button onClick={() => exportJson()}>
              <ExportIcon size={15} />
              {ui("Export JSON")}
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <ImportIcon size={15} />
              {ui("Import JSON")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                event.target.value = "";
              }}
            />
          </>
        }
      />

      {importMessage && (
        <div role="alert" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${importMessage.tone === "error" ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
          <p className="font-semibold">{importMessage.tone === "error" ? ui("Import failed — nothing was changed.") : ui("Imported with adjustments:")}</p>
          <ul className="mt-1 list-disc pl-5 text-xs leading-5">
            {importMessage.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Panel title={ui("Variant details")}>
            <div className="grid gap-4">
              <label className="block">
                <span className={labelClass}>{ui("Variant name")}</span>
                <input
                  value={variant.name}
                  maxLength={80}
                  onChange={(event) => dispatch({ type: "update", recipe: (current) => ({ ...current, name: event.target.value }), coalesceKey: "name" })}
                  className={`${inputClass} mt-1.5 font-serif text-lg`}
                />
              </label>
              <label className="block">
                <span className={labelClass}>{ui("Description")}</span>
                <textarea
                  value={variant.description ?? ""}
                  onChange={(event) => dispatch({ type: "update", recipe: (current) => ({ ...current, description: event.target.value }), coalesceKey: "description" })}
                  rows={3}
                  maxLength={600}
                  placeholder={ui("A short pitch for your variant…")}
                  className={`${inputClass} mt-1.5 resize-y`}
                />
              </label>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                {variant.presetId && <Chip tone="amber">{ui("Based on")} {ui(PRESETS.find((preset) => preset.id === variant.presetId)?.name ?? variant.presetId)}</Chip>}
                {variant.remixedFrom && <Chip tone="violet" title={variant.remixedFrom}>{ui("Remix")}</Chip>}
                {inLibrary && <Chip>{ui("Revision")} {variant.version}</Chip>}
                <Chip>{ui("Updated")} {new Date(variant.updatedAt).toLocaleDateString()}</Chip>
              </div>
            </div>
          </Panel>

          <Panel
            title={ui("Base preset")}
            eyebrow={ui("Start from a blueprint")}
            actions={
              <Button size="sm" onClick={() => setAllPresets((value) => !value)} aria-expanded={allPresets}>
                {allPresets ? ui("Show fewer") : `${ui("All presets")} (${PRESETS.length})`}
              </Button>
            }
          >
            <p className="mb-3 text-xs leading-5 text-zinc-500">{ui("A preset replaces the board, pieces and rules but keeps your name and description. You can undo it.")}</p>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {presets.map((preset) => {
                const current = variant.presetId === preset.id;
                const confirming = confirmPreset === preset.id;
                return (
                  <li key={preset.id}>
                    <button
                      type="button"
                      aria-pressed={current}
                      onClick={() => choosePreset(preset.id)}
                      className={`flex h-full w-full flex-col rounded-2xl border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-amber-300 ${
                        confirming ? "border-red-400/50 bg-red-500/[0.07]" : current ? "border-amber-300/60 bg-amber-300/[0.07]" : "border-white/[0.08] bg-black/20 hover:border-white/25"
                      }`}
                    >
                      <BoardThumbnail preview={presetPreviews[preset.id]} label={`${preset.name} ${ui("preview")}`} className="mx-auto aspect-square w-full max-w-[120px]" />
                      <span className="mt-2 block truncate text-sm font-semibold text-zinc-100">{ui(preset.name)}</span>
                      <span className="line-clamp-2 text-[11px] leading-4 text-zinc-500">{confirming ? ui("Click again to replace the current board, pieces and rules.") : ui(preset.tagline)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel title={ui("Game type")}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/10 text-sky-200">
                  <LayersIcon size={22} />
                </span>
                <div>
                  <p className="font-semibold text-zinc-100">{layers > 1 ? `${ui("Multi-layer 3D")} · ${layers} ${ui("Layers")}` : ui("Single board")}</p>
                  <p className="text-xs text-zinc-500">
                    {variant.teams.length} {ui("players")} · {variant.teams.map((team) => team.name).join(" vs ")}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => goToStep("board")}>
                  {layers > 1 ? ui("Edit layers") : ui("Add layers")}
                </Button>
                <Button size="sm" onClick={() => goToStep("teams")}>
                  {ui("Edit teams")}
                </Button>
              </div>
            </Panel>

            <Panel title={ui("Visibility")}>
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl border ${isPublic ? "border-sky-400/40 bg-sky-400/10 text-sky-200" : "border-white/10 bg-white/[0.04] text-zinc-300"}`}>
                  {isPublic ? <PublicIcon size={22} /> : <PrivateIcon size={22} />}
                </span>
                <div>
                  <p className="font-semibold text-zinc-100">{isPublic ? ui("Public") : ui("Private")}</p>
                  <p className="text-xs text-zinc-500">{isPublic ? ui("Listed in Community") : ui("Only you can see it")}</p>
                </div>
              </div>
              <div className="mt-3">
                {!inLibrary ? (
                  <Button size="sm" tone="primary" onClick={() => void save()}>
                    {ui("Save to My Games first")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    tone={isPublic ? "blue" : "ghost"}
                    disabled={!entry}
                    // Sharing publishes the saved copy, so latest edits are saved first.
                    onClick={async () => {
                      if (dirty && !(await save())) return;
                      setSharing(true);
                    }}
                  >
                    <ShareIcon size={14} />
                    {dirty ? ui("Save & Share") : isPublic ? ui("Manage Sharing") : userId ? ui("Share to Community") : ui("Share")}
                  </Button>
                )}
              </div>
            </Panel>
          </div>
        </div>

        <div className="space-y-5">
          <Panel title={ui("Summary")} padded={false}>
            <ul className="divide-y divide-white/[0.05]">
              {stats.map((stat) => {
                const Icon = STEP_ICONS[stat.step];
                return (
                  <li key={stat.label}>
                    <button type="button" onClick={() => goToStep(stat.step)} className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]">
                      <Icon size={18} className="shrink-0 text-zinc-500 group-hover:text-amber-300" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={labelClass}>{ui(stat.label)}</span>
                          <span className="truncate font-serif text-base text-white">{stat.value}</span>
                        </span>
                        <span className="block truncate text-xs text-zinc-500">{stat.detail}</span>
                      </span>
                      <NextIcon size={14} className="shrink-0 text-zinc-700 transition group-hover:text-amber-300" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title={ui("Starting position")} actions={<Button size="sm" onClick={() => goToStep("position")}>{ui("Edit")}</Button>}>
            <Board2D board={variant.board} variant={variant} theme={theme} label={ui("Starting position preview")} showCoords={false} pieces={variant.setup.pieces.filter((piece) => (piece.z ?? 0) === 0).map((piece, index) => ({ ...piece, key: `${index}` }))} />
          </Panel>
          <div className="lg:hidden">
            <ValidationPanel />
          </div>
          {issues.length === 0 && <p className="text-center text-xs text-emerald-300/80">{ui("No problems found — ready to simulate.")}</p>}
        </div>
      </div>
      <ShareDialog entry={sharing ? entry : null} onClose={() => setSharing(false)} />
    </div>
  );
}
