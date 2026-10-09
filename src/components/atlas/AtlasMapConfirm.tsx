import { ui, useUiLanguage } from "@/i18n/ui";

/** "Country selected · tap again to confirm" under the question, mirroring the prompt on the map. */
export default function AtlasMapConfirm({ pending, onConfirm, onCancel, reserve = true }: { pending: { id: string; label: string } | null; onConfirm: () => void; onCancel: () => void; /** On phones keep the prompt's space free while nothing is selected, so the map below doesn't jump. */ reserve?: boolean }) {
  useUiLanguage();
  if (!pending) return reserve ? <div className="atlas-map-confirm-slot" aria-hidden="true" /> : null;
  return <div className="atlas-map-confirm atlas-map-confirm--panel" role="status">
    <span>{ui(pending.label)} · {ui("tap again to confirm")}</span>
    <button type="button" className="atlas-map-confirm-go" onClick={onConfirm}>{ui("Confirm selection")}</button>
    <button type="button" aria-label={ui("Cancel map selection")} onClick={onCancel}>×</button>
  </div>;
}
