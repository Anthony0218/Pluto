import { ui, useUiLanguage } from "@/i18n/ui";

// Shared by the classic chess room and the two-player variant rooms.
export type PlayerColor = "white" | "black";

const colorOptions = [
  { id: "white", label: "White", symbol: "♔" },
  { id: "black", label: "Black", symbol: "♚" },
] as const;

export function ColorChoice({
  myColor,
  opponentColor,
  opponentName,
  disabled,
  onChange,
}: {
  myColor: PlayerColor | null;
  opponentColor: PlayerColor | null;
  opponentName: string | null;
  disabled: boolean;
  onChange: (color: PlayerColor | null) => void;
}) {
  useUiLanguage();

  return (
    <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label={ui("Your color")}>
      {colorOptions.map((option) => {
        const selected = myColor === option.id;
        const taken = opponentColor === option.id;
        return (
          <label
            key={option.id}
            className={`relative flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber-300 ${
              selected
                ? "border-amber-300/45 bg-amber-300/[0.10]"
                : taken
                  ? "cursor-not-allowed border-white/[0.06] bg-white/[0.015] opacity-45"
                  : "border-white/[0.09] bg-white/[0.025] hover:border-amber-300/30 hover:bg-amber-300/[0.04]"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selected}
              disabled={disabled || taken}
              onChange={() => onChange(selected ? null : option.id)}
            />
            <span
              aria-hidden="true"
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[12px] font-black transition ${
                selected ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/25 bg-black/30 text-transparent"
              }`}
            >
              ✓
            </span>
            <span className={`text-2xl leading-none ${selected ? "text-amber-200" : "text-zinc-300"}`} aria-hidden="true">{option.symbol}</span>
            <span className="min-w-0">
              <span className={`block text-sm font-black ${selected ? "text-amber-100" : "text-zinc-200"}`}>{ui(option.label)}</span>
              <span className="block truncate text-[11px] text-zinc-500">
                {selected ? ui("Your color") : taken ? `${ui("Taken by")} ${opponentName ?? ui("Opponent")}` : ui("Free")}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function ReadyButton({
  ready,
  hasColor,
  saving,
  onToggle,
}: {
  ready: boolean;
  hasColor: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  useUiLanguage();

  return (
    <div className="mt-6">
      <button
        type="button"
        aria-pressed={ready}
        disabled={saving || (!ready && !hasColor)}
        onClick={onToggle}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
          ready
            ? "border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-200 hover:bg-emerald-400/[0.12]"
            : "border-white/[0.12] bg-white/[0.04] text-zinc-200 hover:border-emerald-400/30 hover:bg-emerald-400/[0.05]"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${ready ? "bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,.55)]" : "bg-zinc-600"}`}
          />
          {ready ? ui("Ready") : ui("I'm ready")}
        </span>
        <span className="text-[11px] font-bold text-zinc-500">{ready ? ui("Click to cancel") : ""}</span>
      </button>
      {!hasColor && !ready && (
        <p className="mt-2 text-xs text-zinc-500">{ui("Pick a color to get ready.")}</p>
      )}
    </div>
  );
}
