import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";

const PlanetScene = lazy(() => import("./planetary/PlanetScene"));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="grid h-full place-items-center text-sm text-indigo-200/70">♔ Chess Universe</div> : this.props.children; }
}

export default function LandingHero() {
  useUiLanguage();
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [webgl] = useState(() => {
    try { const canvas = document.createElement("canvas"); return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")); } catch { return false; }
  });
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => { media.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return <section className="relative overflow-hidden border-b border-white/10 bg-[#080d1c] text-white">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(99,102,241,.13),transparent_42%)]" />
    <div className="relative mx-auto grid min-h-[640px] max-w-[1700px] items-center gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.4fr)] lg:px-10">
      <div className="max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.32em] text-indigo-300">{ui("Games + Learning")}</p>
        <h1 className="mt-5 text-5xl font-black leading-[0.96] tracking-[-0.055em] sm:text-6xl xl:text-[78px]">{ui("Play.")}<br />{ui("Learn.")}<br /><span className="bg-gradient-to-r from-sky-300 via-indigo-300 to-violet-400 bg-clip-text text-transparent">{ui("Improve.")}</span></h1>
        <p className="mt-7 max-w-lg text-base leading-7 text-zinc-400">{ui("Play games, learn new skills and use powerful tools to understand how you can get better.")}</p>
        <Link to="/dashboard" className="mt-8 inline-flex min-h-12 items-center gap-4 rounded-xl bg-indigo-500 px-6 py-3 font-bold text-white transition hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">{ui("HOME")}<ArrowRight size={18} /></Link>
      </div>
      <div className="min-w-0">
        <div className="relative h-[350px] overflow-hidden rounded-[28px] bg-[#0c1325] shadow-2xl shadow-black/30 sm:h-[470px] lg:h-[600px]" role="img" aria-label="Orbiting planets representing available games">
          {webgl ? <SceneBoundary><Suspense fallback={<div className="grid h-full place-items-center text-indigo-200/70">♔</div>}><PlanetScene reducedMotion={reducedMotion || hidden} /></Suspense></SceneBoundary> : <div className="grid h-full place-items-center text-sm text-indigo-200/70">♔ Chess Universe</div>}
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200">Chess Universe</div>
        </div>
      </div>
    </div>
  </section>;
}
