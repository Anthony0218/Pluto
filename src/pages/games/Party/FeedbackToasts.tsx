import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useState } from "react";
import { useNewEvents } from "./useNewEvents.ts";
import type { FeedbackKind, Match } from "../../../games/party/types.ts";

interface Toast {
  key: number;
  kind: FeedbackKind;
  text: string;
}
export default function FeedbackToasts({ match }: { match: Match }) {
  useGameLanguage();
  const [toasts, setToasts] = useState<Toast[]>([]);
  useNewEvents(match, (events) => {
    const added = events
      .filter((e) => e.kind !== "EXPLOSION" && e.kind !== "ITEM_USED")
      .map((e) => ({ key: e.id, kind: e.kind, text: e.text }));
    if (!added.length) return;
    setToasts((current) => [...current, ...added].slice(-5));
    const keys = added.map((t) => t.key);
    setTimeout(
      () =>
        setToasts((current) => current.filter((t) => !keys.includes(t.key))),
      3800,
    );
  });
  if (!toasts.length) return null;
  return (
    <div className="pp-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.key} className={`pp-toast pp-toast-${toast.kind}`}>
          {gameUi(toast.text)}
        </div>
      ))}
    </div>
  );
}
