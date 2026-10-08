import { useRef, useState, type CSSProperties } from "react";

/**
 * Keeps a panel as tall as it was before customizing started, so switching modes never makes it jump.
 * Call `lock()` just before the panel enters edit mode and `unlock()` when it leaves.
 */
export function useHeightLock<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number>();
  const style = height ? { minHeight: height } as CSSProperties : undefined;
  return [ref, style, () => setHeight(ref.current?.offsetHeight), () => setHeight(undefined)] as const;
}
