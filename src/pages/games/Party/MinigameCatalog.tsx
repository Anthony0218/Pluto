import { useId, useState } from "react";
import { minigameRegistry } from "../../../games/party/minigames/index.ts";

export default function MinigameCatalog({ selectedIds = [], canSelect = false, onSelect }: {
  selectedIds?: string[];
  canSelect?: boolean;
  onSelect?: (ids: string[]) => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const categoryOrder = (game: ReturnType<typeof minigameRegistry.get>) => game.selectable === false ? 2 : game.gameType === "duel" ? 1 : 0;
  const games = minigameRegistry.all().sort((a, b) => categoryOrder(a) - categoryOrder(b));
  const main = minigameRegistry.pool("main");
  const selected = selectedIds.length ? selectedIds : main.map((g) => g.id);
  const visible = games.filter((game) => {
    const category = filter === "all" || (filter === "solo" && game.gameType === "main" && !game.teamOf && game.selectable !== false)
      || (filter === "teams" && !!game.teamOf) || (filter === "duels" && game.gameType === "duel");
    return category && `${game.name} ${game.description}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  return (
    <section className="pp-card pp-minigame-catalog" aria-labelledby={titleId}>
      <header>
        <div><span className="pp-eyebrow">PICK YOUR KIND OF CHAOS</span><h2 id={titleId}>Minigames <span>{games.length}</span></h2></div>
        {onSelect && <span className="pp-catalog-count">{selected.length}/{main.length} in lineup</span>}
      </header>
      <p>Browse every game and open its rules. Solo and team games can join your lineup; duels happen on the board.</p>
      <div className="pp-catalog-tools">
        <label>Find a minigame<input type="search" value={query} placeholder="Name or description…" onChange={(e) => setQuery(e.target.value)} /></label>
        <label>Game type<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All games</option><option value="solo">Solo competition</option><option value="teams">Team games</option><option value="duels">Board duels</option></select></label>
      </div>
      {onSelect && <div className="pp-catalog-lineup"><small>Every selected game plays before repeating. Keep at least one selected.</small><button type="button" disabled={!canSelect || !selectedIds.length} onClick={() => onSelect([])}>Include all {main.length}</button></div>}
      <div className="pp-catalog-list">
        {visible.map((game) => {
          const selectable = game.gameType === "main" && game.selectable !== false;
          const checked = selected.includes(game.id);
          return <article key={game.id} className="pp-catalog-game">
            <details>
              <summary><strong>{game.name}</strong><span>{game.selectable === false ? "Legacy practice" : game.gameType === "duel" ? "Board duel" : game.teamOf ? `${game.teamFormat ?? "2v2"} teams` : "Solo"} · up to {game.durationSeconds}s</span></summary>
              <p>{game.description}</p>
              <ol>{game.instructions.map((rule, i) => <li key={i}>{rule}</li>)}</ol>
              <p><b>Controls:</b> {game.controls}</p>
              {game.selectable === false && <small>Kept for legacy practice; unavailable in new matches.</small>}
            </details>
            {onSelect && selectable && <label className="pp-catalog-select"><input type="checkbox" aria-label={`Include ${game.name} in lineup`} checked={checked} disabled={!canSelect || (checked && selected.length === 1)} onChange={(e) => onSelect(e.target.checked ? [...selected, game.id] : selected.filter((id) => id !== game.id))} /><span>Include</span></label>}
          </article>;
        })}
        {!visible.length && <p role="status">No games match. Try another search or game type.</p>}
      </div>
      {onSelect && !canSelect && <small>Only the host can change the lineup while connected.</small>}
    </section>
  );
}
