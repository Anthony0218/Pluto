import { ArrowRight, Check, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { isPlayable } from "@/games/chess/custom/engine/board";
import { KING_BEHAVIORS, matchKingBehavior, PRESETS } from "@/games/chess/custom/engine/presets";
import { VICTORY_LABELS } from "@/games/chess/custom/engine/victory";
import { useEditor, type EditorSection } from "@/games/chess/custom/editor/editorContext";
import { getBoardTheme } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";
import Board2D from "../Board2D";
import { Button, Chip, Panel, SectionHeading, inputClass, labelClass } from "../ui";
import ValidationPanel from "../ValidationPanel";

export default function OverviewSection() {
  const editor = useEditor();
  const { variant, dispatch, setSection, dirty, issues, exportJson, importJson } = editor;
  const [importMessage, setImportMessage] = useState<{ tone: "error" | "warning"; lines: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const theme = getBoardTheme(variant.theme.boardTheme);
  const playable = variant.board.cells.filter((cell) => isPlayable(variant.board, cell)).length;
  const special = variant.board.cells.filter((cell) => cell.enabled && cell.tile !== "normal").length;
  const behavior = KING_BEHAVIORS.find((entry) => entry.id === matchKingBehavior(variant.settings));
  const winConditions = variant.victoryConditions.filter((condition) => condition.enabled && condition.type !== "eventOutcome");
  const customPieces = variant.pieces.filter((piece) => !["pawn", "knight", "bishop", "rook", "queen", "king"].includes(piece.id)).length;
  const errors = issues.filter((issue) => issue.severity === "error").length;

  const steps: { id: EditorSection; label: string; done: boolean; detail: string }[] = [
    { id: "presets", label: "Create", done: true, detail: ui(PRESETS.find((preset) => preset.id === variant.presetId)?.name ?? "Imported") },
    { id: "rules", label: "Rules", done: Boolean(behavior), detail: ui(behavior?.label ?? "Custom king rules") },
    { id: "pieces", label: "Pieces", done: variant.pieces.length > 0, detail: `${variant.pieces.length} ${ui("types")}` },
    { id: "board", label: "Board", done: playable > 0, detail: `${variant.board.width}×${variant.board.height}` },
    { id: "test", label: "Test", done: variant.setup.pieces.length > 0, detail: `${variant.setup.pieces.length} ${ui("pieces placed")}` },
    { id: "simulation", label: "3D Simulation", done: errors === 0, detail: errors ? `${errors} ${ui("errors")}` : ui("Ready") },
    { id: "saved", label: "Save", done: !dirty, detail: dirty ? ui("Unsaved") : `v${variant.version}` },
  ];

  const stats = [
    { label: "Board", value: `${variant.board.width}×${variant.board.height}`, detail: `${playable} ${ui("playable")} · ${special} ${ui("special tiles")}`, section: "board" as const },
    { label: "Pieces", value: String(variant.pieces.length), detail: `${customPieces} ${ui("custom")} · ${variant.setup.pieces.length} ${ui("on the board")}`, section: "pieces" as const },
    { label: "King rule", value: ui(behavior?.label ?? "Custom"), detail: ui(variant.settings.royalMode === "checkmate" ? "Check is enforced" : variant.settings.royalMode === "capture" ? "Kings can be captured" : "No royal pieces"), section: "rules" as const },
    { label: "Victory", value: String(winConditions.length), detail: winConditions.map((condition) => ui(VICTORY_LABELS[condition.type])).join(" · ") || ui("None yet"), section: "victory" as const },
    { label: "Events", value: String(variant.events.length), detail: `${variant.events.filter((event) => event.enabled).length} ${ui("enabled")}`, section: "events" as const },
  ];

  async function handleImport(file: File) {
    const result = importJson(await file.text());
    if (result.errors.length) setImportMessage({ tone: "error", lines: result.errors });
    else setImportMessage(result.warnings.length ? { tone: "warning", lines: result.warnings } : null);
  }

  return (
    <div>
      <SectionHeading
        eyebrow="Overview"
        title="Your chess game"
        description={ui("Every variant — standard chess included — is one configuration of the same rule engine. Work through the steps below, test as you go, then watch it play in 3D.")}
        actions={
          <>
            <Button onClick={() => exportJson()}>
              <Download size={15} />
              {ui("Export JSON")}
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={15} />
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

      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {steps.map((step, index) => (
          <li key={step.label}>
            <button
              type="button"
              onClick={() => setSection(step.id)}
              className="group flex h-full w-full flex-col rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition hover:border-amber-300/30 hover:bg-amber-300/[0.04]"
            >
              <span className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${step.done ? "bg-amber-300 text-zinc-950" : "border border-white/20 text-zinc-500"}`}>
                  {step.done ? <Check size={12} /> : index + 1}
                </span>
                <span className="text-sm font-semibold text-zinc-100">{ui(step.label)}</span>
              </span>
              <span className="mt-1.5 truncate pl-7 text-xs text-zinc-500">{step.detail}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {stats.map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => setSection(stat.section)}
                className="group rounded-2xl border border-white/[0.08] bg-[#0d1014]/85 p-4 text-left transition hover:border-amber-300/30"
              >
                <p className={labelClass}>{ui(stat.label)}</p>
                <p className="mt-1.5 flex items-center justify-between font-serif text-2xl text-white">
                  {stat.value}
                  <ArrowRight size={16} className="text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-amber-300" />
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{stat.detail}</p>
              </button>
            ))}
          </div>

          <Panel title={ui("Description")} eyebrow={ui("Tell players what makes it special")}>
            <textarea
              value={variant.description ?? ""}
              onChange={(event) => dispatch({ type: "update", recipe: (current) => ({ ...current, description: event.target.value }), coalesceKey: "description" })}
              rows={3}
              maxLength={600}
              placeholder={ui("A short pitch for your variant…")}
              className={`${inputClass} resize-y`}
            />
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
              <Chip>{ui("Schema")} v{variant.schemaVersion}</Chip>
              <Chip>{ui("Revision")} {variant.version}</Chip>
              {variant.presetId && <Chip tone="amber">{ui("Based on")} {PRESETS.find((preset) => preset.id === variant.presetId)?.name}</Chip>}
              {variant.remixedFrom && <Chip tone="violet" title={variant.remixedFrom}>{ui("Remix")}</Chip>}
              <Chip>{ui("Updated")} {new Date(variant.updatedAt).toLocaleDateString()}</Chip>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title={ui("Starting position")} actions={<Button size="sm" onClick={() => setSection("test")}>{ui("Edit")}</Button>}>
            <Board2D
              board={variant.board}
              variant={variant}
              theme={theme}
              label={ui("Starting position preview")}
              showCoords={false}
              pieces={variant.setup.pieces.map((piece, index) => ({ ...piece, key: `${index}` }))}
            />
          </Panel>
          <div className="lg:hidden">
            <ValidationPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
