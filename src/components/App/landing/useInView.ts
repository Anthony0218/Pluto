import { useEffect, useState, type RefObject } from "react";

/** True while the element is within `margin` of the viewport; used to pause loops nobody can see. */
export function useInView(ref: RefObject<Element | null>, margin = "0px") {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: margin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, margin]);
  return visible;
}
