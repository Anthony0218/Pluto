import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { lazy, Suspense, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

// The builder (engine, editor, templates) loads on demand.
const Home = lazy(() => import("./CardBuilder/CardBuilderHome.tsx"));
const Template = lazy(() => import("./CardBuilder/TemplatePage.tsx"));
const Create = lazy(() => import("./CardBuilder/CreatePage.tsx"));
const Play = lazy(() => import("./CardBuilder/PlayPage.tsx"));
const Simulation = lazy(() => import("./CardBuilder/SimulationPage.tsx"));
const Room = lazy(() => import("./CardBuilder/RoomPage.tsx"));

function Lazy({ children }: { children: ReactNode }) {
  useGameLanguage();
  return <Suspense fallback={<main className="min-h-[var(--app-height)] px-6 py-10 text-sm text-zinc-500">Loading the card builder…</main>}>{gameUi(children)}</Suspense>;
}

export function CardBuilderHomeRoute() {
  return (
    <Lazy>
      <Home />
    </Lazy>
  );
}

export function CardBuilderTemplateRoute() {
  return (
    <Lazy>
      <Template />
    </Lazy>
  );
}

/** The page itself decides when a different game means a fresh editor (a first save must not reset it). */
export function CardBuilderCreateRoute() {
  return (
    <Lazy>
      <Create />
    </Lazy>
  );
}

export function CardBuilderPlayRoute() {
  const { search } = useLocation();
  return (
    <Lazy>
      <Play key={search} />
    </Lazy>
  );
}

export function CardBuilderSimulationRoute() {
  return (
    <Lazy>
      <Simulation />
    </Lazy>
  );
}

export function CardBuilderRoomRoute() {
  return (
    <Lazy>
      <Room />
    </Lazy>
  );
}
