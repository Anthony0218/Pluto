import { useEffect, useRef, useState } from "react";

/** True once the element has scrolled into view (and stays true), for animations that should start when it is seen. */
export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setSeen(true); observer.disconnect(); } }, { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}
