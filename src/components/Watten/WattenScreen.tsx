import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * The smallest layouts the Watten tables are designed for. When the screen is
 * smaller than this the whole table is zoomed out instead of overflowing, so
 * a game never needs scrolling.
 */
const DESKTOP_MIN = { width: 1120, height: 780 };
const MOBILE_MIN = { width: 360, height: 680 };
/** Phones and portrait tablets get the stacked layout; it is drawn at phone size and enlarged to fit. */
const MOBILE_BREAKPOINT = 900;
const MOBILE_MAX_SCALE = 1.5;
const MIN_SCALE = 0.45;
/** Panels that must show everything they contain; any that overflow shrink the whole layout a little more. */
const FIT_TARGETS = ".watten-table, .watten-aside, .watten-aside-card, .watten-single-controls, .watten-game-grid";

/**
 * Full-height, non-scrolling frame for a Watten game page. The child with the
 * `watten-game-content` class is sized to the free space and zoomed out when
 * that space is smaller than the layout needs. `data-wt-mode` ("desktop" or
 * "mobile") tells the stylesheet which table layout to use.
 */
export default function WattenScreen({ children, className = "" }: { children: ReactNode; className?: string }) {
  const screen = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const frame = screen.current;
    if (!frame) return;
    let raf = 0;

    const fit = () => {
      const content = frame.querySelector<HTMLElement>(":scope > .watten-game-content");
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      if (!content || !width || !height) return;
      const mobile = width < MOBILE_BREAKPOINT;
      const min = mobile ? MOBILE_MIN : DESKTOP_MIN;
      frame.dataset.wtMode = mobile ? "mobile" : "desktop";
      const apply = (scale: number) => {
        content.style.zoom = scale === 1 ? "" : String(scale);
        content.style.width = `${Math.floor(width / scale)}px`;
        content.style.height = `${Math.floor(height / scale)}px`;
      };
      let scale = Math.min(mobile ? MOBILE_MAX_SCALE : 1, width / min.width, height / min.height);
      apply(scale);
      // Zoom out further while a panel still holds more than it can show.
      for (let pass = 0; pass < 6 && scale > MIN_SCALE; pass++) {
        let overY = 0;
        let overX = 0;
        for (const element of content.querySelectorAll<HTMLElement>(FIT_TARGETS)) {
          overY = Math.max(overY, element.scrollHeight - element.clientHeight);
          overX = Math.max(overX, element.scrollWidth - element.clientWidth);
        }
        if (overY <= 2 && overX <= 2) break;
        const designHeight = height / scale;
        const designWidth = width / scale;
        scale = Math.max(MIN_SCALE, Math.min(scale, height / (designHeight + overY), width / (designWidth + overX)) * 0.99);
        apply(scale);
      }
      // Dialogs are full-viewport overlays; this is how far down the app header covers them, in the content's own (zoomed) pixels.
      frame.style.setProperty("--wt-top", `${Math.round(Math.max(0, frame.getBoundingClientRect().top) / scale)}px`);
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };

    const resize = new ResizeObserver(fit);
    resize.observe(frame);
    // Views swap in and out as a game moves between its setup, table and result screens.
    const mutation = new MutationObserver(schedule);
    mutation.observe(frame, { childList: true, subtree: true });
    fit();
    return () => { cancelAnimationFrame(raf); resize.disconnect(); mutation.disconnect(); };
  }, []);

  return <main ref={screen} className={`watten-game-screen text-white ${className}`}>{children}</main>;
}
