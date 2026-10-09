import { useId, useState, type CSSProperties } from "react";

/** The upper half of a portrait card forms each horizontal-cut tab. */
export default function SchafkopfCardTabs({ tabs, selected, onSelect, cardTheme, frontImage, label, panelId, idPrefix }: {
  tabs: readonly { id: string; label: string }[]; selected: string; onSelect: (id: string) => void;
  cardTheme: string; frontImage: string; label: string; panelId?: string; idPrefix?: string;
}) {
  const [cardRatio, setCardRatio] = useState(155 / 242);
  const generatedPrefix = useId();
  const prefix = idPrefix ?? generatedPrefix;
  return <div className="sk-card-tabs" style={{ "--sk-tab-ratio": cardRatio } as CSSProperties} data-deck={cardTheme} role="tablist" aria-label={label}>
    {tabs.map((tab, index) => <button key={tab.id} id={`${prefix}-${tab.id}`} type="button" role="tab" aria-controls={panelId} aria-selected={selected === tab.id} tabIndex={selected === tab.id ? 0 : -1} className={`sk-card-tab ${selected === tab.id ? "is-selected" : ""}`} onClick={() => onSelect(tab.id)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); onSelect(tabs[next].id);
      document.getElementById(`${prefix}-${tabs[next].id}`)?.focus();
    }}><span className="sk-card-tab-art" aria-hidden="true">{selected === tab.id ? <img src={frontImage} alt="" draggable={false} onLoad={event => { const img = event.currentTarget; if (img.naturalHeight) setCardRatio(img.naturalWidth / img.naturalHeight); }} /> : <span className="sk-card-tab-back">✦</span>}</span><span className="sk-card-tab-label">{tab.label}</span></button>)}
  </div>;
}
