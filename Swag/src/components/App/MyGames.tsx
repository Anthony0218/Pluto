import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, GridList, GridListItem, I18nProvider, useDragAndDrop } from "react-aria-components";
import { ArrowLeft, ArrowRight, Check, GripVertical, Pencil, Plus, X } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { games } from "@/data/games";
import { favoriteLimit, reorderFavorites } from "@/data/dashboard";
import { useAuth } from "@/context/AuthContext";
import { useFavoriteGames } from "@/hooks/useFavoriteGames";
import DashboardDialog from "./dashboard/DashboardDialog";

export default function MyGames() {
  const { user } = useAuth();
  const { language } = useUiLanguage();
  return <I18nProvider locale={language === "bar" ? "de" : language}><FavoriteGames key={user?.id ?? "guest"} userId={user?.id} /></I18nProvider>;
}
function FavoriteGames({ userId }: { userId?: string }) {
  useUiLanguage();
  const { routes, loading, saving, error, save } = useFavoriteGames(userId);
  const [draft, setDraft] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [selector, setSelector] = useState(false);
  const [filter, setFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(4);
  const gridRef = useRef<HTMLDivElement>(null);
  const previousPositions = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const cards = gridRef.current?.querySelectorAll<HTMLElement>("[data-game-route]") ?? [];
    const nextPositions = new Map<string, DOMRect>();
    for (const card of cards) {
      const route = card.dataset.gameRoute!;
      const current = card.getBoundingClientRect();
      const previous = previousPositions.current.get(route);
      nextPositions.set(route, current);
      if (previous && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const x = previous.left - current.left;
        const y = previous.top - current.top;
        if (x || y) card.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "translate(0, 0)" }], { duration: 220, easing: "ease-out" });
      }
    }
    previousPositions.current = nextPositions;
  }, [draft, editing]);
  const selected = editing ? draft : routes;
  const visible = editing ? draft : routes.slice(0, visibleCount);
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ "text/plain": String(key) })),
    renderDragPreview: items => {
      const game = games.find(item => item.route === items[0]?.["text/plain"]);
      const card = [...(gridRef.current?.querySelectorAll<HTMLElement>("[data-game-route]") ?? [])]
        .find(item => item.dataset.gameRoute === game?.route);
      const bounds = card?.getBoundingClientRect();
      return <div className="favorite-card favorite-drag-preview" style={{ width: bounds?.width, height: bounds?.height }} aria-hidden="true">
        <img src={game?.image} alt="" />
        <div className="favorite-caption"><strong>{ui(game?.title ?? "Move game")}</strong><small>{ui(game?.subtitle ?? "")}</small></div>
      </div>;
    },
    getAllowedDropOperations: () => ["move"],
    onReorder: event => setDraft(current => reorderFavorites(current, new Set([...event.keys].map(String)), String(event.target.key), event.target.dropPosition === "after" ? "after" : "before")),
    isDisabled: saving,
  });
  function customize(openSelector = false) {
    if (!editing) { setDraft(routes); setEditing(true); }
    setSelector(openSelector); setFilter("");
  }
  async function commit() { if (await save(draft)) setEditing(false); }
  return <section className="dashboard-games dash-panel" aria-labelledby="my-games-title">
    <div className="dash-section-heading">
      <div><h2 id="my-games-title">{ui("My games")}</h2><p>{ui(editing ? "Drag to reorder, or use the arrow buttons. Save when you are ready." : "Your favorites, always one move away.")}</p></div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {!editing && visibleCount < favoriteLimit && <button type="button" className="dash-icon-button" aria-label={ui("Show more games")} title={ui("Show more games")} onClick={() => setVisibleCount(Math.min(favoriteLimit, visibleCount + 2))}><Plus size={17} /></button>}
        {!editing && visibleCount >= favoriteLimit && <button type="button" className="dash-icon-button" aria-label={ui("Show fewer games")} title={ui("Show fewer games")} onClick={() => setVisibleCount(4)}><span aria-hidden="true">−</span></button>}
        {editing ? <><button className="dash-button" disabled={saving} onClick={() => setEditing(false)}>{ui("Cancel")}</button><button className="dash-button primary" disabled={saving} onClick={() => void commit()}><Check size={15} />{ui(saving ? "Saving..." : "Save")}</button></> : <><Link to="/games" className="dash-button">{ui("All games")}<ArrowRight size={14} /></Link><button className="dash-button primary" disabled={loading} onClick={() => customize()}><Pencil size={14} />{ui("Customize")}</button></>}
      </div>
    </div>
    {error && <p role="alert" className="mb-3 text-sm text-rose-300">{ui(error)}</p>}
    {loading ? <div className="dash-panel py-12 text-center text-sm text-slate-400" role="status">{ui("Loading your games…")}</div> : <>
      <div className="favorite-row">
        {editing ? <GridList ref={gridRef} dependencies={[draft, saving]} aria-label={ui("Reorder favorite games")} items={visible.map(route => games.find(game => game.route === route)!)} layout="grid" orientation="horizontal" selectionMode="none" dragAndDropHooks={dragAndDropHooks} className="favorite-sortable">
          {game => <GridListItem id={game.route} data-game-route={game.route} textValue={ui(game.title)} className="favorite-card editing">
            <img src={game.image} alt="" draggable={false} />
            <div className="favorite-tools"><Button slot="drag" aria-label={ui("Move game") + ": " + ui(game.title)} className="dash-icon-button"><GripVertical size={17} /></Button><Button isDisabled={saving} onPress={() => setDraft(draft.filter(route => route !== game.route))} aria-label={ui("Remove game") + ": " + ui(game.title)} className="dash-icon-button"><X size={15} /></Button></div>
            <div className="favorite-caption"><strong>{ui(game.title)}</strong><small>{ui(game.subtitle)}</small><div className="mt-2 flex gap-1"><Button className="dash-icon-button" isDisabled={saving || draft.indexOf(game.route) === 0} aria-label={ui("Move earlier") + ": " + ui(game.title)} onPress={() => setDraft(reorderFavorites(draft, new Set([game.route]), draft[draft.indexOf(game.route) - 1], "before"))}><ArrowLeft size={14} /></Button><Button className="dash-icon-button" isDisabled={saving || draft.indexOf(game.route) === draft.length - 1} aria-label={ui("Move later") + ": " + ui(game.title)} onPress={() => setDraft(reorderFavorites(draft, new Set([game.route]), draft[draft.indexOf(game.route) + 1], "after"))}><ArrowRight size={14} /></Button></div></div>
          </GridListItem>}
        </GridList> : visible.map(route => { const game = games.find(item => item.route === route)!; return <Link key={route} to={route} className="favorite-card"><img src={game.image} alt="" /><div className="favorite-caption"><strong>{ui(game.title)}</strong><small>{ui(game.subtitle)}</small></div></Link>; })}
        {selected.length < favoriteLimit && <button className="favorite-card favorite-empty" disabled={saving} onClick={() => customize(true)}><span className="favorite-plus"><Plus size={27} /></span><strong>{ui("Add game")}</strong><small>{selected.length} / {favoriteLimit} {ui("selected")}</small></button>}
      </div>
      {editing && <p className="sr-only" aria-live="polite">{draft.map(route => ui(games.find(game => game.route === route)!.title)).join(", ")}</p>}
    </>}
    {selector && <DashboardDialog title={ui("Choose a game")} onClose={() => setSelector(false)}>
      <input className="dash-input mb-4" aria-label={ui("Search games")} placeholder={ui("Search games")} value={filter} onChange={event => setFilter(event.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2">{games.filter(game => ui(game.title).toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(game => <button key={game.route} disabled={draft.includes(game.route) || draft.length >= favoriteLimit} className="game-choice" onClick={() => { setDraft([...draft, game.route]); setSelector(false); }}><img src={game.image} alt="" /><span>{ui(game.title)}</span>{draft.includes(game.route) ? <Check size={16} /> : <Plus size={16} />}</button>)}</div>
      {!games.some(game => ui(game.title).toLocaleLowerCase().includes(filter.toLocaleLowerCase())) && <p className="text-sm text-slate-400">{ui("No results found.")}</p>}
    </DashboardDialog>}
  </section>;
}
