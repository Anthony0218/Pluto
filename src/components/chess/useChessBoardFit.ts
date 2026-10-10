import { useEffect, useRef } from "react";

/** Keep the whole board visible when status, rewards, or viewport size change. */
export default function useChessBoardFit() {
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = frameRef.current;
    const grid = frame?.closest<HTMLElement>(".chess-game-grid");
    if (!frame || !grid || frame.closest("aside")) return;
    // Starting a game from a scrolled setup screen should reveal the board.
    const scrollViewport = frame.closest<HTMLElement>(".app-viewport");
    if (scrollViewport) scrollViewport.scrollTop = 0;
    let showingResult = Boolean(grid.querySelector(".chess-status-row"));
    let showingControls = Boolean(grid.querySelector("[data-chess-controls]"));
    let scheduled = 0;
    let disposed = false;
    const fit = () => {
      scheduled = 0;
      if (disposed) return;
      const viewport = window.visualViewport;
      // Include the app's scroll container, not just the browser's document.
      let top = frame.getBoundingClientRect().top + window.scrollY;
      for (let ancestor = frame.parentElement; ancestor; ancestor = ancestor.parentElement) top += ancestor.scrollTop;
      const available = Math.max(120, (viewport?.height ?? window.innerHeight) - top - 16);
      const size = `${Math.floor(Math.min(1100, available))}px`;
      if (grid.style.getPropertyValue("--board-size") !== size) grid.style.setProperty("--board-size", size);
    };
    const schedule = () => {
      if (!disposed && !scheduled) scheduled = requestAnimationFrame(fit);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    const page = grid.parentElement;
    if (page) observer.observe(page);
    // Observe new result boxes as well as text/button wrapping within them.
    const observeContent = () => {
      const hasResult = Boolean(grid.querySelector(".chess-status-row"));
      const hasControls = Boolean(grid.querySelector("[data-chess-controls]"));
      if (((hasResult && !showingResult) || (hasControls && !showingControls)) && scrollViewport) scrollViewport.scrollTop = 0;
      showingResult = hasResult;
      showingControls = hasControls;
      grid.querySelectorAll("section, header, [role=status], .chess-status-row").forEach(element => observer.observe(element));
      if (page) [...page.children].forEach(element => observer.observe(element));
      schedule();
    };
    const mutations = new MutationObserver(observeContent);
    mutations.observe(page ?? grid, { childList: true, subtree: true, characterData: true });
    observeContent();
    void document.fonts.ready.then(schedule);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      disposed = true;
      cancelAnimationFrame(scheduled);
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      grid.style.removeProperty("--board-size");
    };
  }, []);
  return frameRef;
}
