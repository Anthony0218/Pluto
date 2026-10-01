import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

// three.js pages load on demand so the rest of the app does not ship the 3D engine.
const Chess3DAiPage = lazy(() => import("./Chess/Chess3DAiPage.tsx"));
const Chess3DHotseatPage = lazy(() => import("./3DChess/Chess3DHotseatPage.tsx"));
const ChessCustomPage = lazy(() => import("./ChessCustom/ChessCustomPage.tsx"));

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="min-h-[var(--app-height)] bg-[#07090b]" />}>{children}</Suspense>;
}

export function Chess3DAiRoute() {
  return (
    <Lazy>
      <Chess3DAiPage />
    </Lazy>
  );
}

export function Chess3DHotseatRoute() {
  return (
    <Lazy>
      <Chess3DHotseatPage />
    </Lazy>
  );
}

export function ChessCustomRoute() {
  return (
    <Lazy>
      <ChessCustomPage />
    </Lazy>
  );
}

/** `/chess-custom` is a short alias for the Chess Custom editor; the query (e.g. ?section=board) is kept. */
export function ChessCustomAlias() {
  const { search } = useLocation();
  return <Navigate to={`/games/chess/custom${search}`} replace />;
}
