import { Component, lazy, Suspense, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useLanding } from "./landingContext";
import JourneyItems from "./JourneyItems";
import JourneyTitle from "./JourneyTitle";
import JourneyPlanet from "./JourneyPlanet";
import { usePlanetPose } from "./planetPose";
import UniverseFlyby from "./UniverseFlyby";
import { useInView } from "./useInView";
import "./landingJourney.css";

// The WebGL planet and nebula are a separate chunk, only fetched on desktop layouts with WebGL.
const JourneyCanvas = lazy(() => import("./JourneyCanvas"));

let webgl: boolean | undefined;
function webglAvailable() {
  if (webgl === undefined) {
    try {
      const probe = document.createElement("canvas");
      const context = probe.getContext("webgl2") ?? probe.getContext("webgl");
      webgl = !!context;
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { webgl = false; }
  }
  return webgl;
}

/** If the canvas ever throws (lost context, driver trouble) the CSS planet underneath simply carries on. */
class GlBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * Wraps the flyby and the feature sections. A sticky layer holds the one planet that travels down the page,
 * and (on desktop) the flyby section pins a stage that the camera pushes through.
 */
export default function LandingJourney({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const { withFlyby } = useLanding();
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root, "200px");
  if (reducedMotion) return <div>{children}</div>;
  return <div ref={root} className="journey" data-paused={visible ? undefined : ""}>
    <JourneyLayer visible={visible} />
    {withFlyby && <UniverseFlyby />}
    {children}
  </div>;
}

function JourneyLayer({ visible }: { visible: boolean }) {
  const pose = usePlanetPose();
  const { withFlyby } = useLanding();
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);
  const canDraw = withFlyby && !failed && webglAvailable();
  return <div className="journey-layer" data-gl={canDraw && drawn ? "" : undefined} aria-hidden="true">
    <div className="journey-nebula" />
    {canDraw && <GlBoundary onFail={() => setFailed(true)}><Suspense fallback={null}><JourneyCanvas pose={pose} active={visible} onReady={() => setDrawn(true)} /></Suspense></GlBoundary>}
    <JourneyPlanet pose={pose} />
    <JourneyItems pose={pose} />
    <JourneyTitle pose={pose} />
  </div>;
}
