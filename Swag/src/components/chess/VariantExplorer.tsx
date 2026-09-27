import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, X } from "lucide-react";
import { variants, type VariantCard } from "@/data/chessVariants";
import { ui, useUiLanguage } from "@/i18n/ui";
import "./variantExplorer.css";

const filters = ["All variants", "Singleplayer", "Multiplayer", "Hotseat"] as const;
export default function VariantExplorer({ children, renderVariant }: {
  children: ReactNode; renderVariant: (variant: VariantCard, index: number) => ReactNode;
}) {
  useUiLanguage();
  const [phase, setPhase] = useState<"closed" | "opening" | "open" | "closing">("closed");
  const [filter, setFilter] = useState<typeof filters[number]>("All variants");
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const open = phase !== "closed";
  function close() {
    trigger.current?.focus();
    setPhase("closing");
  }
  const supported = variants.filter(variant => variant.available && (
    filter === "Singleplayer" ? !!variant.aiRoute : filter === "Multiplayer" ? !!variant.multiplayerRoute : filter === "Hotseat" ? !!variant.route : true
  ));
  return <div className="variant-explorer-host" data-phase={phase}>
    <button ref={trigger} type="button" className="variant-explorer-trigger" aria-expanded={open} aria-controls="variant-explorer" disabled={phase === "opening" || phase === "closing"} onClick={() => open ? close() : setPhase("opening")}>
      <span aria-hidden="true">♞</span>{ui("All variants")}<ArrowDown size={16} />
    </button>
    <div className="variant-explorer-stage">
      <div className="variant-explorer-preview" inert={open} aria-hidden={open}>{children}</div>
      {open && <section id="variant-explorer" aria-label={ui("Variant Explorer")} className="variant-explorer" data-phase={phase}
        onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}
        onAnimationEnd={event => {
          if (event.target !== event.currentTarget) return;
          if (phase === "opening") { setPhase("open"); closeButton.current?.focus(); }
          if (phase === "closing") setPhase("closed");
        }}>
        <div className="variant-explorer-heading">
          <span className="variant-explorer-piece" aria-hidden="true">♞</span>
          <h2>{ui("Variant Explorer")}</h2>
          <button ref={closeButton} type="button" aria-label={ui("Close explorer")} onClick={close}><X size={18} /></button>
        </div>
        <div className="variant-explorer-body" inert={phase !== "open"}>
          <div className="variant-explorer-filters" aria-label={ui("Filter variants")}>{filters.map(item => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{ui(item)}</button>)}</div>
          <p className="sr-only" aria-live="polite">{supported.length} {ui("variants")}</p>
          <div className="variant-explorer-grid">{supported.map(renderVariant)}</div>
        </div>
      </section>}
    </div>
  </div>;
}
