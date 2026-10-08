import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AtlasResultHero } from "../src/components/atlas/AtlasResultHero";
import { AtlasRandomSeriesResults } from "../src/components/atlas/AtlasRandomSeriesResults";
import { AtlasSeriesIntermission } from "../src/components/atlas/AtlasSeriesIntermission";
import "../src/index.css";
import "../src/pages/games/AtlasArena/atlas-arena.css";

// Isolated, interactive presentation fixture; no account or server mutations.
export default function Preview() {
  const kind = new URLSearchParams(location.search).get("view") ?? "casual";
  const [next, setNext] = useState(false);
  const [ready, setReady] = useState(false);
  const [deadline] = useState(() => Date.now() + 45_000);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer); }, []);
  const players = [{ id: "a", name: "Alice", ready }, { id: "b", name: "Bob", ready: false }];
  if (next) return <main className="atlas-page atlas-center"><h1>Next game · Closest Wins</h1><p>Both Continue signals received.</p></main>;
  if (kind === "ranked") return <main className="atlas-page atlas-center atlas-random-results">
    <AtlasResultHero eyebrow="Ranked · Game 1 complete" title="Alice wins the game" />
    <p className="atlas-result-score">1 – 0 <small>game wins · Best of 3</small></p>
    <AtlasSeriesIntermission players={players} userId="a" ranked endsAt={new Date(deadline).toISOString()} now={now} gameNumber={2} modeTitle="Closest Wins" busy={false} onReady={() => setReady(true)} />
  </main>;
  return <AtlasRandomSeriesResults order={kind === "single" ? ["map-battle"] : ["map-battle", "closest-wins", "stat-battle"]} players={players} results={[{ mode: "map-battle", winnerId: "a", scores: { a: 500, b: 200 } }, ...(kind === "final" ? [{ mode: "closest-wins", winnerId: "a", scores: { a: 900, b: 100 } }] : [])]} complete={kind === "final" || kind === "single"} onNext={() => setNext(true)} onAgain={() => setNext(true)} />;
}
createRoot(document.getElementById("root")!).render(<MemoryRouter><Preview /></MemoryRouter>);
