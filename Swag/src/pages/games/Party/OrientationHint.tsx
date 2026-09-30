import { useState } from "react";
import { X } from "lucide-react";

// Non-blocking tip for realtime screens on small portrait phones. Pure CSS decides visibility (no
// orientation API needed); dismissing it lasts for this tab.
export default function OrientationHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("pluto-party-rotate-hint") === "1";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;
  return (
    <div className="pp-rotate-hint" role="note">
      <span aria-hidden="true">📱↻</span> Rotate your phone for the best experience.
      <button
        className="pp-icon-button"
        aria-label="Dismiss rotate tip"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem("pluto-party-rotate-hint", "1");
          } catch {
            // Dismissal simply will not persist.
          }
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
