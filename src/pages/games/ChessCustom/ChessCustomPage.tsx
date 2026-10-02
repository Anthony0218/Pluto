import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import ChessCustomNav from "@/components/chessCustom/ChessCustomNav";
import CommunityView from "@/components/chessCustom/community/CommunityView";
import CreateStepper from "@/components/chessCustom/create/CreateStepper";
import StepPager from "@/components/chessCustom/create/StepPager";
import UnsavedChangesDialog from "@/components/chessCustom/dialogs/UnsavedChangesDialog";
import EditorToast from "@/components/chessCustom/EditorToast";
import MyGamesView from "@/components/chessCustom/library/MyGamesView";
import OnboardingGuide from "@/components/chessCustom/onboarding/OnboardingGuide";
import OnlineMatchView from "@/components/chessCustom/online/OnlineMatchView";
import BoardSection from "@/components/chessCustom/sections/BoardSection";
import EventsSection from "@/components/chessCustom/sections/EventsSection";
import OverviewSection from "@/components/chessCustom/sections/OverviewSection";
import PiecesSection from "@/components/chessCustom/sections/PiecesSection";
import PositionSection from "@/components/chessCustom/sections/PositionSection";
import RulesSection from "@/components/chessCustom/sections/RulesSection";
import TeamsSection from "@/components/chessCustom/sections/TeamsSection";
import VictorySection from "@/components/chessCustom/sections/VictorySection";
import VariantToolbar from "@/components/chessCustom/VariantToolbar";
import EditorProvider from "@/games/chess/custom/editor/EditorProvider";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { leavesCreate, type CreateStep } from "@/games/chess/custom/library/navigation";
import { readGuideState, shouldAutoShowGuide, writeGuideState, type GuideState } from "@/games/chess/custom/library/onboarding";
import { ui, useUiLanguage } from "@/i18n/ui";

// The simulation loads on demand; its 3D view additionally lazy-loads three.js.
const SimulationView = lazy(() => import("@/components/chessCustom/simulation/SimulationView"));

const STEP_SECTIONS: Record<Exclude<CreateStep, "simulation">, () => React.JSX.Element> = {
  overview: OverviewSection,
  board: BoardSection,
  teams: TeamsSection,
  pieces: PiecesSection,
  rules: RulesSection,
  events: EventsSection,
  victory: VictorySection,
  position: PositionSection,
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const guideStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

function SimulationFallback() {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-zinc-500" role="status">
      <span className="mr-3 h-4 w-4 rounded-full border-2 border-amber-300/30 border-t-amber-300 motion-safe:animate-spin" />
      {ui("Loading the simulation…")}
    </div>
  );
}

function ChessCustomShell() {
  const { route, step, dispatch, save, isDirty, variant, discardChanges, pendingReplace, resolveReplace, libraryStatus } = useEditor();
  const [guideOpen, setGuideOpen] = useState(false);

  // Leaving Create with unsaved edits asks first (moving between steps never does).
  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => leavesCreate(currentLocation.pathname, nextLocation.pathname) && isDirty(), [isDirty]));

  // New visitors get the guide once, on My Games, after their library has loaded.
  useEffect(() => {
    if (!shouldAutoShowGuide(readGuideState(guideStorage()), route, libraryStatus === "ready")) return;
    const timer = window.setTimeout(() => setGuideOpen(true), 400);
    return () => window.clearTimeout(timer);
  }, [route, libraryStatus]);
  const closeGuide = useCallback((state: GuideState) => {
    writeGuideState(guideStorage(), state);
    setGuideOpen(false);
  }, []);

  useEffect(() => {
    if (route.view !== "create") return;
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void save();
        return;
      }
      // Inside text fields the browser's own undo applies.
      if (isTyping(event.target)) return;
      if (key === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, save, route.view]);

  const dialogs = (
    <>
      <UnsavedChangesDialog
        open={blocker.state === "blocked"}
        name={variant.name}
        intent="leave"
        onCancel={() => blocker.reset?.()}
        onDiscard={async () => {
          await discardChanges();
          blocker.proceed?.();
        }}
        onSave={async () => {
          if (await save()) blocker.proceed?.();
        }}
      />
      <UnsavedChangesDialog open={Boolean(pendingReplace)} name={pendingReplace?.name ?? ""} intent="replace" onCancel={() => void resolveReplace("cancel")} onDiscard={() => resolveReplace("discard")} onSave={() => resolveReplace("save")} />
      <OnboardingGuide open={guideOpen} onClose={closeGuide} />
    </>
  );

  // Focused, full-bleed simulation: Create → Simulation, or a Singleplayer/Hotseat game.
  const simulation = (route.view === "create" && step === "simulation") || (route.view === "play" && route.mode !== "multiplayer");
  if (simulation) {
    const context = route.view === "play" ? "play" : "create";
    return (
      <main className="relative left-1/2 flex min-h-[var(--app-height)] w-screen -translate-x-1/2 flex-col bg-[#050608] text-zinc-100">
        {/* The header's own mode chip names Singleplayer/Hotseat; the description names the variant. */}
        <ChessPageHeader className="chess-menu-header" title="Chess Custom" description={context === "create" ? ui("Simulation") : variant.name} />
        <Suspense fallback={<SimulationFallback />}>
          <SimulationView key={`${route.view}:${route.view === "play" ? route.mode : step}`} context={context} />
        </Suspense>
        <EditorToast />
        {dialogs}
      </main>
    );
  }

  const Section = route.view === "create" && step !== "simulation" ? STEP_SECTIONS[step] : null;
  return (
    <main className="chess-custom-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 bg-[#07090b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(245,158,11,.07),transparent_32%),radial-gradient(circle_at_88%_80%,rgba(56,189,248,.05),transparent_30%)]" />
      <ChessPageHeader className="chess-menu-header" title="Chess Custom" description={ui("Variant creator & simulator")} />
      <div className="relative mx-auto w-full max-w-[1800px] px-4 pb-16 sm:px-6">
        <ChessCustomNav route={route} onShowGuide={() => setGuideOpen(true)} />
        {route.view === "library" && <MyGamesView />}
        {route.view === "community" && <CommunityView />}
        {route.view === "pluto" && <CommunityView scope="pluto" />}
        {route.view === "play" && route.mode === "multiplayer" && <OnlineMatchView />}
        {Section && (
          <>
            <VariantToolbar />
            <div className="grid gap-6 pt-4 lg:grid-cols-[250px_minmax(0,1fr)]">
              <CreateStepper />
              <div className="min-w-0">
                <Section />
                <StepPager />
              </div>
            </div>
          </>
        )}
      </div>
      {!Section && <EditorToast />}
      {dialogs}
    </main>
  );
}

export default function ChessCustomPage() {
  useUiLanguage();
  return (
    <EditorProvider>
      <ChessCustomShell />
    </EditorProvider>
  );
}
