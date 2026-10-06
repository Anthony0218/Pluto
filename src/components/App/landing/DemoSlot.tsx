import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mounts its children (typically a lazy demo) only once the slot is near the viewport, so demos below the fold
 * cost nothing until the visitor gets there. Keeps its height reserved meanwhile to avoid layout shift.
 */
export default function DemoSlot({ children, height = 420 }: { children: ReactNode; height?: number }) {
  const slot = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const element = slot.current;
    if (!element || armed) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setArmed(true); observer.disconnect(); } }, { rootMargin: "500px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [armed]);
  return <div ref={slot} style={armed ? undefined : { minHeight: height }}>
    {armed && <Suspense fallback={<div className="demo-skeleton" style={{ minHeight: height }} aria-hidden="true" />}>{children}</Suspense>}
  </div>;
}
