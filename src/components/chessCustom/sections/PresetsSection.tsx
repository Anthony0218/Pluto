import { useMemo, useState } from "react";
import { createVariantFromPreset, PRESETS, type PresetId } from "@/games/chess/custom/engine/presets";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { getBoardTheme } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";
import Board2D from "../Board2D";
import { Button, Chip, SectionHeading } from "../ui";

export default function PresetsSection() {
  const { loadPreset, dirty, variant } = useEditor();
  const [confirming, setConfirming] = useState<PresetId | null>(null);
  // Previews are built once; loading a preset builds a fresh, editable copy.
  const previews = useMemo(() => PRESETS.map((preset) => ({ preset, variant: createVariantFromPreset(preset.id, 7) })), []);

  return (
    <div>
      <SectionHeading
        eyebrow="Presets"
        title="Start from a blueprint"
        description={ui("Every preset is an ordinary variant built with the same engine — load one and change anything.")}
      />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {previews.map(({ preset, variant: preview }) => {
          const theme = getBoardTheme(preview.theme.boardTheme);
          const current = variant.presetId === preset.id;
          return (
            <article key={preset.id} className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1014]/90 transition hover:border-amber-300/30">
              <div className="p-4 pb-0" style={{ background: theme.backdrop }}>
                <div className="mx-auto max-w-[220px] pb-4">
                  <Board2D board={preview.board} variant={preview} theme={theme} pieces={preview.setup.pieces.map((piece, index) => ({ ...piece, key: String(index) }))} showCoords={false} label={`${preset.name} preview`} />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-lg">{preset.icon}</span>
                  <h3 className="font-serif text-lg text-white">{ui(preset.name)}</h3>
                  {current && <Chip tone="amber">{ui("Current base")}</Chip>}
                </div>
                <p className="mt-1 flex-1 text-sm leading-6 text-zinc-400">{ui(preset.tagline)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {preset.tags.map((tag) => (
                    <Chip key={tag}>{tag}</Chip>
                  ))}
                </div>
                {confirming === preset.id ? (
                  <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">
                    <p>{ui("Your current variant has unsaved changes. Loading a preset replaces it and clears undo history — save first to keep it.")}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" tone="primary" onClick={() => loadPreset(preset.id)}>
                        {ui("Replace")}
                      </Button>
                      <Button size="sm" onClick={() => setConfirming(null)}>
                        {ui("Cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button className="mt-4" tone="primary" onClick={() => (dirty ? setConfirming(preset.id) : loadPreset(preset.id))}>
                    {ui("Use this preset")}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
