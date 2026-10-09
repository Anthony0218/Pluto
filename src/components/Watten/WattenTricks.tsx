import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useCardTheme } from "@/context/CardThemeContext";
import { ui } from "@/i18n/ui";
import { WATTEN_CARD_CLIP, type WattenCard } from "@/utils/watten";
import { getWattenCardImage } from "@/utils/WattenCardImages";

/** One finished trick: who played which card and who took it. */
export type WattenTrickRecord = {
  plays: { seat: number; name: string; card: WattenCard }[];
  winnerSeat: number;
};

/** A player cannot take more than three tricks in a round, so three groups are all a pile ever needs to draw. */
const MAX_VISIBLE_TRICKS = 3;

/**
 * The tricks a player has taken, one group of cards per trick with every card
 * of that trick in it (three or four, by table size). The most recent trick of
 * the round lies face-up and highlighted and can be opened; older tricks stay
 * face down and cannot be opened, as at a real table.
 */
export function WattenTrickPile({ count, name, last, onView, cardsPerTrick = 4, className = "" }: {
  count: number;
  name: string;
  /** Set only on the pile of the player who took the latest trick. */
  last?: WattenTrickRecord | null;
  onView?: () => void;
  /** Players at the table, which is how many cards make up a trick. */
  cardsPerTrick?: number;
  className?: string;
}) {
  const { cardTheme } = useCardTheme();
  const shown = Math.min(count, MAX_VISIBLE_TRICKS);
  const label = `${name}: ${count} ${ui(count === 1 ? "Trick" : "Tricks")}`;
  const groups = Array.from({ length: shown }, (_, index) => {
    const isLast = Boolean(last) && index === shown - 1;
    if (!isLast || !last) {
      return <span key={index} className="wt-pile-group is-old" aria-hidden="true">
        {Array.from({ length: cardsPerTrick }, (_, card) => <i key={card} className="wt-pile-card" />)}
      </span>;
    }
    const cards = last.plays.map(play => <img key={`${play.seat}-${play.card.id}`} className={`wt-pile-card is-face-up${play.seat === last.winnerSeat ? " is-winner" : ""}`}
      src={getWattenCardImage(play.card, cardTheme)} alt="" draggable={false} style={{ clipPath: WATTEN_CARD_CLIP }} />);
    const tag = <span className="wt-pile-tag" aria-hidden="true">{ui("Last trick")}</span>;
    return onView
      ? <button key={index} type="button" onClick={onView} className="wt-pile-group is-last is-viewable" aria-label={`${ui("Show last trick")} · ${name}`} title={ui("Show last trick")}>{tag}{cards}</button>
      : <span key={index} className="wt-pile-group is-last" aria-hidden="true">{tag}{cards}</span>;
  });
  return <div role="group" aria-label={label} className={`wt-pile${last ? " has-last" : ""} ${className}`}>
    <span className="wt-pile-stack">
      {shown === 0 && <i className="wt-pile-empty" aria-hidden="true" />}
      {groups}
    </span>
    <span className="wt-pile-count" aria-hidden="true"><b>{count}</b><small>{ui(count === 1 ? "Trick" : "Tricks")}</small></span>
  </div>;
}

/** The latest trick, opened over the table. Closing it, or any new trick, hides it again. */
export function WattenLastTrickViewer({ trick, open, onClose, nameOf }: {
  trick: WattenTrickRecord | null;
  open: boolean;
  onClose: () => void;
  nameOf?: (seat: number) => string;
}) {
  const { cardTheme } = useCardTheme();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) close.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || !trick) return null;
  const winner = trick.plays.find(play => play.seat === trick.winnerSeat);
  return <div className="wt-trick-viewer" role="dialog" aria-label={ui("Last trick")} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="wt-trick-viewer-panel">
      <button ref={close} type="button" className="wt-trick-viewer-close" aria-label={ui("Close")} onClick={onClose}><X size={16} /></button>
      <p className="wt-trick-viewer-title">{ui("Last trick")}</p>
      <p className="wt-trick-viewer-winner">{ui("Won by")} <strong>{nameOf?.(trick.winnerSeat) ?? winner?.name}</strong></p>
      <div className="wt-trick-viewer-cards">
        {trick.plays.map(play => <figure key={`${play.seat}-${play.card.id}`} className={play.seat === trick.winnerSeat ? "is-winner" : ""}>
          <img src={getWattenCardImage(play.card, cardTheme)} alt={`${play.card.suit} ${play.card.rank}`} draggable={false} style={{ clipPath: WATTEN_CARD_CLIP }} />
          <figcaption>{nameOf?.(play.seat) ?? play.name}</figcaption>
        </figure>)}
      </div>
      <p className="wt-trick-viewer-note">{ui("Earlier tricks stay face down.")}</p>
    </div>
  </div>;
}
