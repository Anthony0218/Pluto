import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Fit the full question/feedback to its allotted viewport, including after fonts or images load. */
export function AtlasFitContent({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const outer = viewport.current, inner = content.current;
    if (!outer || !inner) return;
    const fit = () => {
      const available = outer.clientHeight;
      if (available > 0) setScale(Math.min(1, available / Math.max(1, inner.scrollHeight)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer); observer.observe(inner);
    return () => observer.disconnect();
  }, []);
  return <div ref={viewport} className="atlas-fit-viewport"><div ref={content} className="atlas-fit-content" style={{ transform: `scale(${scale})` }}>{children}</div></div>;
}
