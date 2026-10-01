import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { legacyChessCustomTarget } from "@/games/chess/custom/library/navigation";

// three.js pages load on demand so the rest of the app does not ship the 3D engine.
const ChessCustomPage = lazy(() => import("./ChessCustom/ChessCustomPage.tsx"));

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="min-h-[var(--app-height)] bg-[#07090b]" />}>{children}</Suspense>;
}

export function Chess3DAiRoute() {
  const { search } = useLocation();
  const difficulty = new URLSearchParams(search).get("difficulty");
  const ai = difficulty === "easy" || difficulty === "beginner" ? "random" : difficulty === "hard" || difficulty === "expert" ? "master" : difficulty === "medium" ? "strategist" : "greedy";
  return <Navigate to={`/chess-custom/play/singleplayer?preset=3d-chess&ai=${ai}`} replace />;
}

export function Chess3DHotseatRoute() {
  return <Navigate to="/chess-custom/play/hotseat?preset=3d-chess" replace />;
}

export function Chess3DMenuRoute() {
  return <Navigate to="/chess-custom/create/overview?preset=3d-chess" replace />;
}

/** `/chess-custom/*`: My Games, Create, Community and Play all live under one page. */
export function ChessCustomRoute() {
  return (
    <Lazy>
      <ChessCustomPage />
    </Lazy>
  );
}

/** Old `/games/chess/custom?section=…` links land on the matching new route. */
export function ChessCustomLegacyRedirect() {
  const { search } = useLocation();
  return <Navigate to={legacyChessCustomTarget(search)} replace />;
}
