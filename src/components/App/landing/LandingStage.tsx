import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useMotionValue, useTransform } from "motion/react";
import { useLandingReducedMotion as useReducedMotion } from "./motionPreference";
import type { UniverseCategory } from "../planetary/universeCatalog";
import { LandingContext, type CaptionFlight, type CaptionSpot, type HeroSpot, type StageInfo } from "./landingContext";
import { clamp01, flybyProgress, heroHandoffProgress, journeyIndex } from "./landingMath";
import { useMediaQuery, useViewportScroll, VIEWPORT_SELECTOR } from "./viewport";

const categories: UniverseCategory[] = ["games", "tools", "learn"];

/**
 * Owns the landing page's shared state: which hero tab is selected, and the scroll progress values that the
 * hero, the flyby and the travelling planet all read. Sections are found through `data-journey-flyby` and
 * `data-journey-stop` (with `data-tone`, `data-feature`, `data-side`); hero objects through `data-flyby-id`.
 */
export default function LandingStage({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const withFlyby = desktop && !reducedMotion;
  const [category, setCategory] = useState<UniverseCategory>("games");
  const root = useRef<HTMLDivElement>(null);
  const { scrollY } = useViewportScroll();
  const stage = useRef<StageInfo>({ anchors: { viewport: 800, flyby: null, stops: [] }, stops: [], hero: {}, captions: {}, width: 1440, height: 800 });
  const layout = useMotionValue(0);
  const wide = useMotionValue(desktop ? 1 : 0);
  const categoryIndex = useMotionValue(0);
  useEffect(() => { wide.set(desktop ? 1 : 0); }, [desktop, wide]);
  useEffect(() => { categoryIndex.set(categories.indexOf(category)); }, [category, categoryIndex]);

  useLayoutEffect(() => {
    const element = root.current;
    const viewport = element?.closest<HTMLElement>(VIEWPORT_SELECTOR);
    if (element && !withFlyby) delete element.dataset.captionMotion;
    if (!element || !viewport || reducedMotion) return;
    const measure = () => {
      const journey = element.querySelector<HTMLElement>(".journey");
      if (!journey) return;
      const origin = viewport.getBoundingClientRect().top - viewport.scrollTop;
      const top = (node: Element) => node.getBoundingClientRect().top - origin;
      const height = viewport.clientHeight;
      const flybyNode = element.querySelector("[data-journey-flyby]");
      const corner = journey.getBoundingClientRect();
      const stopNodes = [...element.querySelectorAll<HTMLElement>("[data-journey-stop]")];
      // Layout offsets ignore the travelling copy's transforms, keeping resize measurements stable mid-flight.
      const captionSpot = (node: HTMLElement): CaptionSpot => {
        let x = 0, y = 0;
        for (let parent: HTMLElement | null = node; parent; parent = parent.offsetParent as HTMLElement | null) { x += parent.offsetLeft; y += parent.offsetTop; }
        const heading = node.querySelector<HTMLElement>("[data-caption-heading]")!;
        return { x, y, width: node.offsetWidth, fontSize: parseFloat(getComputedStyle(heading).fontSize) };
      };
      const targets = new Map([...element.querySelectorAll<HTMLElement>("[data-caption-target]")].map(node => [node.dataset.captionTarget, node]));
      const captions: Record<string, CaptionFlight> = {};
      for (const source of withFlyby ? element.querySelectorAll<HTMLElement>("[data-caption-source]") : []) {
        const id = source.dataset.captionSource!;
        const target = targets.get(id);
        if (!target) continue;
        const from = captionSpot(source);
        if (source.closest("[data-journey-flyby]") && flybyNode) from.y += flybyNode.getBoundingClientRect().height - height;
        captions[id] = {
          from, to: captionSpot(target),
          arrival: stopNodes.indexOf(source.closest<HTMLElement>("[data-journey-stop]")!) + 1,
          section: stopNodes.indexOf(target.closest<HTMLElement>("[data-journey-stop]")!) + 1,
          hasLine: !!target.querySelector("[data-caption-line]"),
        };
      }
      const hero: Record<string, HeroSpot> = {};
      for (const node of element.querySelectorAll<HTMLElement>("[data-flyby-id]")) {
        const rect = node.querySelector(".solar-art, .universe-app, .universe-book")?.getBoundingClientRect();
        if (rect?.width) hero[node.dataset.flybyId!] = { x: rect.left + rect.width / 2 - corner.left, y: rect.top + rect.height / 2 - corner.top, size: rect.width };
      }
      stage.current = {
        anchors: {
          viewport: height,
          flyby: flybyNode ? { start: top(flybyNode), end: top(flybyNode) + flybyNode.getBoundingClientRect().height - height } : null,
          stops: [...element.querySelectorAll("[data-journey-stop]")].map(node => top(node) + node.getBoundingClientRect().height / 2 - height / 2),
        },
        stops: [...element.querySelectorAll<HTMLElement>("[data-journey-stop]")].map(node => ({ tone: node.dataset.tone ?? "chess", feature: node.dataset.feature ?? null, side: node.dataset.side === "left" ? -1 : node.dataset.side === "center" ? 0 : 1, hidden: node.dataset.planet === "off", arrival: node.dataset.arrival !== undefined })),
        hero,
        captions,
        width: journey.clientWidth,
        height: journey.querySelector<HTMLElement>(".journey-layer")?.clientHeight ?? height,
      };
      layout.set(layout.get() + 1);
      if (withFlyby) element.dataset.captionMotion = "";
      else delete element.dataset.captionMotion;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(element);
    for (const node of element.querySelectorAll("[data-journey-flyby], [data-journey-stop], .landing-universe")) observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, withFlyby, category, layout]);

  const index = useTransform(() => { layout.get(); return journeyIndex(scrollY.get(), stage.current.anchors); });
  const flyby = useTransform(() => { layout.get(); return flybyProgress(scrollY.get(), stage.current.anchors); });
  const handoff = useTransform(() => { layout.get(); const scroll = scrollY.get(); return withFlyby ? heroHandoffProgress(scroll, stage.current.anchors) : 0; });
  // Derived values must read every motion value they depend on unconditionally: Motion subscribes to the ones
  // read during the first run only.
  const enter = useTransform(() => {
    layout.get();
    const scroll = scrollY.get();
    const pinned = stage.current.anchors.flyby?.start ?? 0;
    return pinned > 0 ? clamp01(scroll / pinned) : 0;
  });

  return <LandingContext.Provider value={{ category, setCategory, withFlyby, stage, layout, index, flyby, enter, handoff, wide, categoryIndex }}>
    <div ref={root} className="landing-stage">{children}</div>
  </LandingContext.Provider>;
}
