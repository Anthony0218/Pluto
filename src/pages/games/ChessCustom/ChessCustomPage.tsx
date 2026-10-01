import { lazy, Suspense, useEffect } from "react";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import EditorSidebar from "@/components/chessCustom/EditorSidebar";
import EditorToast from "@/components/chessCustom/EditorToast";
import VariantToolbar from "@/components/chessCustom/VariantToolbar";
import BoardSection from "@/components/chessCustom/sections/BoardSection";
import CommunitySection from "@/components/chessCustom/sections/CommunitySection";
import EventsSection from "@/components/chessCustom/sections/EventsSection";
import OverviewSection from "@/components/chessCustom/sections/OverviewSection";
import PiecesSection from "@/components/chessCustom/sections/PiecesSection";
import PresetsSection from "@/components/chessCustom/sections/PresetsSection";
import RulesSection from "@/components/chessCustom/sections/RulesSection";
import SavedSection from "@/components/chessCustom/sections/SavedSection";
import TeamsSection from "@/components/chessCustom/sections/TeamsSection";
import TestSection from "@/components/chessCustom/sections/TestSection";
import VictorySection from "@/components/chessCustom/sections/VictorySection";
import EditorProvider from "@/games/chess/custom/editor/EditorProvider";
import { useEditor, type EditorSection } from "@/games/chess/custom/editor/editorContext";
import { ui, useUiLanguage } from "@/i18n/ui";

// The simulation loads on demand; its 3D tab additionally lazy-loads three.js.
const SimulationView = lazy(() => import("@/components/chessCustom/simulation/SimulationView"));

const SECTIONS: Record<Exclude<EditorSection, "simulation" | "simulation2d">, () => React.JSX.Element> = {
  overview: OverviewSection,
  board: BoardSection,
  teams: TeamsSection,
  pieces: PiecesSection,
  rules: RulesSection,
  events: EventsSection,
  victory: VictorySection,
  test: TestSection,
  presets: PresetsSection,
  saved: SavedSection,
  community: CommunitySection,
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

function ChessCustomShell() {
  const { section, dispatch, save } = useEditor();

  useEffect(() => {
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
  }, [dispatch, save]);

  if (section === "simulation" || section === "simulation2d") {
    // One element for both tabs keeps the running game when switching between 3D and 2D.
    return (
      <main className="relative left-1/2 flex min-h-[var(--app-height)] w-screen -translate-x-1/2 flex-col bg-[#050608] text-zinc-100">
        <ChessPageHeader className="chess-menu-header" title="Chess Custom" description={section === "simulation" ? ui("3D Simulation") : ui("2D Simulation")} />
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500" role="status">
              <span className="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" />
              {ui("Loading the simulation…")}
            </div>
          }
        >
          <SimulationView view={section === "simulation" ? "3d" : "2d"} />
        </Suspense>
        <EditorToast />
      </main>
    );
  }

  const Section = SECTIONS[section];
  return (
    <main className="chess-custom-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 bg-[#07090b] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(245,158,11,.07),transparent_32%),radial-gradient(circle_at_88%_80%,rgba(56,189,248,.05),transparent_30%)]" />
      <ChessPageHeader className="chess-menu-header" title="Chess Custom" description={ui("Variant creator & simulator")} />
      <div className="relative mx-auto w-full max-w-[1800px] px-4 pb-16 sm:px-6">
        <VariantToolbar />
        <div className="grid gap-6 pt-4 lg:grid-cols-[230px_minmax(0,1fr)]">
          <EditorSidebar />
          <div className="min-w-0">
            <Section />
          </div>
        </div>
      </div>
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
