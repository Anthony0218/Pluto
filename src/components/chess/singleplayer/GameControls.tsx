import { ui, useUiLanguage } from "@/i18n/ui";
type GameControlsProps = {
  gameName: string;
  whitePlayer: string;
  blackPlayer: string;
  onGameNameChange: (value: string) => void;
  onWhitePlayerChange: (value: string) => void;
  onBlackPlayerChange: (value: string) => void;
  onUndo: () => void;
  onRestart: () => void;
  onSave: () => void;
};

export default function GameControls({
  gameName,
  whitePlayer,
  blackPlayer,
  onGameNameChange,
  onWhitePlayerChange,
  onBlackPlayerChange,
  onUndo,
  onRestart,
  onSave,
}: GameControlsProps) {
  useUiLanguage();
  const inputClass =
    "w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 py-2.5 " +
    "text-sm text-zinc-100 placeholder:text-zinc-600 " +
    "outline-none transition-all duration-200 " +
    "hover:border-zinc-600 " +
    "focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20";

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">{ui("Game name")}</label>

          <input
            type="text"
            value={gameName}
            onChange={(e) => onGameNameChange(e.target.value)}
            placeholder={ui("My chess game")}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">{ui("White player")}</label>

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-zinc-300">
              ♔
            </span>

            <input
              type="text"
              value={whitePlayer}
              onChange={(e) => onWhitePlayerChange(e.target.value)}
              placeholder={ui("White")}
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">{ui("Black player")}</label>

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-zinc-300">
              ♚
            </span>

            <input
              type="text"
              value={blackPlayer}
              onChange={(e) => onBlackPlayerChange(e.target.value)}
              placeholder={ui("Black")}
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-zinc-800" />

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onUndo}
          className="
            rounded-xl
            bg-sky-500
            px-4 py-2.5
            text-sm font-semibold text-white
            shadow-lg shadow-sky-500/15
            transition-all duration-200
            hover:bg-sky-400
            hover:shadow-sky-500/25
            active:scale-[0.98]
          "
        >{ui("Undo")}</button>

        <button
          type="button"
          onClick={onRestart}
          className="
            rounded-xl
            bg-amber-500
            px-4 py-2.5
            text-sm font-semibold text-zinc-950
            shadow-lg shadow-amber-500/15
            transition-all duration-200
            hover:bg-amber-400
            hover:shadow-amber-500/25
            active:scale-[0.98]
          "
        >{ui("Restart")}</button>

        <button
          type="button"
          onClick={onSave}
          className="
            col-span-2
            rounded-xl
            bg-emerald-500
            px-4 py-2.5
            text-sm font-semibold text-white
            shadow-lg shadow-emerald-500/15
            transition-all duration-200
            hover:bg-emerald-400
            hover:shadow-emerald-500/25
            active:scale-[0.98]
          "
        >{ui("Save Game")}</button>
      </div>
    </div>
  );
}
