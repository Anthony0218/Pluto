import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ui } from "@/i18n/ui";

import ChessGameReview from "../chess/singleplayer/ChessGameReview";

export default function ReviewDemoDialog({ moves, onClose }: { moves: string[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={dialog} aria-label={ui("Sample game review")} onCancel={onClose} className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-white backdrop:bg-black/70">
      <ChessGameReview moves={moves} open onClose={onClose} />
    </dialog>, document.body,
  );
}
