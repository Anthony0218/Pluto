import { useLayoutEffect } from "react";

/**
 * Keep Watten setup panels inside the space below the fixed public header by
 * scaling them down. Pass `active` as false while the page shows something
 * else (e.g. the table) so the hook binds again when the menu comes back.
 */
export function useFitWattenScreen(active = true) {
  useLayoutEffect(() => {
    if (!active) return;
    const screen = document.querySelector<HTMLElement>(".watten-menu--screen");
    const content = screen?.firstElementChild as HTMLElement | null;
    if (!screen || !content) return;

    const fit = () => {
      const styles = getComputedStyle(screen);
      const height = screen.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
      const width = screen.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      const scale = Math.min(1, height / content.offsetHeight, width / content.offsetWidth);
      content.style.setProperty("--watten-fit-scale", String(Number.isFinite(scale) ? scale : 1));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(screen);
    observer.observe(content);
    fit();
    return () => observer.disconnect();
  }, [active]);
}
