import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Pencil, Plus, Receipt, ShoppingCart, Trash2 } from 'lucide-react';
import { useTodoKeyboard } from '@/hooks/useTodoKeyboard';
import { useLifeTools } from '@/hooks/useLifeTools';
import { useBillGroups } from '@/hooks/useBillGroups';
import { supabase } from '@/lib/supabase';
import { portionNumber, validNutritionRecipe, type NutritionRecipe } from '@/data/calorieTools';
import { linkedExpenseTotals, linkExpense, type ShoppingList, type ShoppingItem } from '@/data/todoTools';
import type { ExpenseGroup } from '@/data/lifeTools';
import { DeleteAction } from './LifeToolParts';
import RecipeShoppingAction from './RecipeShoppingAction';

const units = { piece: 'Stück', g: 'g', kg: 'kg', l: 'l', ml: 'ml', serving: 'Portionen' };
const money = (amount: number, currency: string) => new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount / 100);
const emptyItem = () => ({ name: '', quantity: '1', unit: 'piece' as ShoppingItem['unit'] });

function ShoppingEditor({ list, groups, recipes, billError, refreshBills }: { list: ShoppingList; groups: ExpenseGroup[]; recipes: NutritionRecipe[]; billError: string; refreshBills: () => void }) {
  const { update, loading } = useLifeTools();
  const [draft, setDraft] = useState(emptyItem), [editing, setEditing] = useState<string | null>(null), [message, setMessage] = useState(''), [deleted, setDeleted] = useState<ShoppingItem | null>(null);
  const [groupId, setGroupId] = useState(''), [expenseId, setExpenseId] = useState(''), [recipeId, setRecipeId] = useState('');
  const nameInput = useRef<HTMLInputElement>(null), searchInput = useRef<HTMLInputElement>(null), [query, setQuery] = useState('');
  const commit = (change: (current: ShoppingList) => ShoppingList) => { let found = false; const ok = update(current => ({ ...current, shoppingLists: current.shoppingLists.map(l => { if (l.id !== list.id) return l; found = true; return change(l); }) })); return ok && found; };
  const reset = () => { setEditing(null); setDraft(emptyItem()); };
  const edit = (item: ShoppingItem) => { setEditing(item.id); setDraft({ name: item.name, quantity: String(item.quantity), unit: item.unit }); nameInput.current?.focus(); };
  const toggle = (item: ShoppingItem) => { if (!commit(current => ({ ...current, items: current.items.map(i => i.id === item.id ? { ...i, done: !i.done } : i) }))) setMessage('Änderung konnte nicht gespeichert werden.'); };
  const remove = (item: ShoppingItem) => { if (commit(current => ({ ...current, items: current.items.filter(i => i.id !== item.id) }))) { setDeleted(item); setMessage('Artikel gelöscht. Du kannst ihn rückgängig machen.'); if (editing === item.id) reset(); } else setMessage('Artikel konnte nicht gelöscht werden.'); };
  useTodoKeyboard(() => { reset(); nameInput.current?.focus(); }, searchInput);
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.key === 'Escape') { reset(); target.blur(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { const form = target.closest('form'); if (form) { event.preventDefault(); form.requestSubmit(); } return; }
    if (target.matches('input,textarea,select') || target.isContentEditable || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); reset(); nameInput.current?.focus(); }
    if (event.key === '/') { event.preventDefault(); searchInput.current?.focus(); }
  };
  const group = groups.find(g => g.id === groupId), recipe = recipes.find(r => r.id === recipeId), totals = linkedExpenseTotals(list, groups);
  const visible = list.items.filter(i => `${i.name} ${i.recipes.join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div onKeyDown={keyboard}>
    <div className="todo-shopping-heading"><h3>{list.name}</h3><span>{list.items.filter(i => i.done).length} von {list.items.length} eingekauft</span></div>
    <div className="todo-layout"><section className="calorie-card todo-panel" aria-label="Artikel der Einkaufsliste">
      <input ref={searchInput} type="search" className="todo-search" aria-label="Einkaufsliste durchsuchen" placeholder="Artikel oder Rezept suchen …" value={query} onChange={e => setQuery(e.target.value)} aria-keyshortcuts="/"/>
      <form className="todo-item-form" onSubmit={e => { e.preventDefault(); const quantity = portionNumber(draft.quantity); if (!quantity) { setMessage('Bitte eine Menge größer als null eingeben.'); return; } const previous = list.items.find(i => i.id === editing); if (editing && !previous) { setMessage('Der Artikel wurde inzwischen gelöscht.'); return; } const item: ShoppingItem = { id: editing ?? crypto.randomUUID(), name: draft.name.trim(), quantity, unit: draft.unit, done: previous?.done ?? false, recipes: previous?.recipes ?? [] }; if (commit(current => ({ ...current, items: editing ? current.items.map(i => i.id === editing ? item : i) : [...current.items, item] }))) { reset(); setMessage(editing ? 'Artikel aktualisiert.' : 'Artikel hinzugefügt.'); nameInput.current?.focus(); } else setMessage('Artikel konnte nicht gespeichert werden. Prüfe Name, Menge und Speichergrenze.'); }}>
        <label>Artikel<input ref={nameInput} required maxLength={100} value={draft.name} placeholder="z. B. Tomaten" onChange={e => setDraft({ ...draft, name: e.target.value })} aria-keyshortcuts="N"/></label><label>Menge<input required inputMode="decimal" value={draft.quantity} onChange={e => setDraft({ ...draft, quantity: e.target.value })}/></label><label>Einheit<select value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value as ShoppingItem['unit'] })}>{Object.entries(units).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><button className="calorie-primary" disabled={loading} aria-label={editing ? 'Artikel speichern' : 'Artikel hinzufügen'}><Plus size={16}/>{editing ? 'Speichern' : 'Hinzufügen'}</button>{editing && <button type="button" className="calorie-secondary" onClick={reset}>Abbrechen</button>}
      </form>
      <ul className="todo-items">{visible.map(item => <li key={item.id} className={`todo-row ${item.done ? 'is-done' : ''}`}><div className="todo-row-main" tabIndex={0} aria-label={`${item.name}, ${item.quantity} ${units[item.unit]}`} onKeyDown={event => {
        if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const rows = [...event.currentTarget.closest('ul')!.querySelectorAll<HTMLElement>('.todo-row-main')], index = rows.indexOf(event.currentTarget); rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
        if (event.key === ' ') { event.preventDefault(); toggle(item); }
        if (event.key.toLowerCase() === 'e') { event.preventDefault(); edit(item); }
        if (event.key === 'Delete') { event.preventDefault(); remove(item); }
      }}><input type="checkbox" disabled={loading} checked={item.done} aria-label={`${item.name} eingekauft`} onChange={() => toggle(item)}/><div className="todo-content"><strong>{item.name}</strong><span>{item.quantity.toLocaleString('de-DE')} {units[item.unit]}</span>{item.recipes.length > 0 && <small>Aus: {item.recipes.join(', ')}</small>}</div><div className="todo-row-actions"><button type="button" className="calorie-icon-button" aria-label={`${item.name} bearbeiten`} onClick={() => edit(item)}><Pencil size={16}/></button><button type="button" className="calorie-icon-button" disabled={loading} aria-label={`${item.name} löschen`} onClick={() => remove(item)}><Trash2 size={16}/></button></div></div></li>)}</ul>
      {!visible.length && <div className="todo-empty"><ShoppingCart size={32}/><h4>{query ? 'Keine passenden Artikel' : 'Dein Einkauf beginnt hier'}</h4><p>Trage Artikel ein oder übernimm Zutaten aus dem Rezeptbuch.</p></div>}
      <p role="status" className="calorie-status">{message}</p>{deleted && <button type="button" className="calorie-secondary" disabled={loading} onClick={() => { if (commit(current => ({ ...current, items: [...current.items.filter(i => i.id !== deleted.id), deleted] }))) { setDeleted(null); setMessage('Artikel wiederhergestellt.'); } else setMessage('Artikel konnte nicht wiederhergestellt werden.'); }}>Löschen rückgängig: {deleted.name}</button>}
      <details className="todo-shortcuts"><summary>Tastatursteuerung</summary><p><kbd>N</kbd> Neuer Artikel · <kbd>/</kbd> Suche · <kbd>↑</kbd> <kbd>↓</kbd> Auswählen</p><p><kbd>E</kbd> Bearbeiten · <kbd>Leertaste</kbd> Abhaken · <kbd>Entf</kbd> Löschen · <kbd>Esc</kbd> Abbrechen</p><p><kbd>⌘ / Strg + Enter</kbd> Formular speichern. Einzeltasten gelten außerhalb von Eingabefeldern, Zeilenaktionen auf der ausgewählten Zeile.</p></details>
    </section><aside className="todo-sidebar"><section className="calorie-card todo-panel"><span className="calorie-label"><BookOpen size={14}/> Rezeptbuch</span><h3>Vom Rezept zum Einkauf</h3><p className="calorie-empty">Zutaten passend zu deinen Portionen übernehmen.</p><label>Rezept<select value={recipeId} onChange={e => setRecipeId(e.target.value)}><option value="">Rezept auswählen</option>{recipes.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>{recipe && <RecipeShoppingAction key={recipe.id} recipe={recipe} listId={list.id}/>}<Link className="lt-text-link" to="/tools/calorie-tracker?section=recipes">Rezeptbuch öffnen →</Link></section>
      <section className="calorie-card todo-panel"><span className="calorie-label"><Receipt size={14}/> Bill Splitter</span><h3>Rechnungen verbinden</h3><p className="calorie-empty">Beträge bleiben mit dem Gruppenbuch verbunden und aktualisieren sich mit der Rechnung.</p>{billError && <p role="alert" className="pt-error">Gruppen konnten nicht geladen werden. <button type="button" className="calorie-secondary" onClick={refreshBills}>Erneut laden</button></p>}
        <form className="todo-form" onSubmit={e => { e.preventDefault(); setMessage(commit(current => linkExpense(current, { groupId, expenseId })) ? 'Rechnung verknüpft.' : 'Verknüpfung konnte nicht gespeichert werden.'); setExpenseId(''); }}><label>Gruppe<select value={groupId} onChange={e => { setGroupId(e.target.value); setExpenseId(''); }}><option value="">Gruppe auswählen</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name} · {g.currency}</option>)}</select></label><label>Rechnung<select required value={expenseId} onChange={e => setExpenseId(e.target.value)} disabled={!group}><option value="">Rechnung auswählen</option>{group?.expenses.filter(e => !list.expenseLinks.some(l => l.groupId === group.id && l.expenseId === e.id)).map(e => <option key={e.id} value={e.id}>{e.title} · {money(e.amount, group.currency)}</option>)}</select></label><button className="calorie-secondary" disabled={loading || !group || !expenseId}>Rechnung verknüpfen</button></form>
        {group && <Link className="lt-text-link" to={`/tools/bill-splitter?group=${encodeURIComponent(group.id)}&newExpense=${encodeURIComponent(list.id)}`}>Neue Rechnung für diese Liste erfassen →</Link>}
        {!groups.length && !billError && <Link className="lt-text-link" to="/tools/bill-splitter">Im Bill Splitter eine Gruppe erstellen →</Link>}
        <ul className="todo-linked-bills">{list.expenseLinks.map(ref => { const linkedGroup = groups.find(g => g.id === ref.groupId), expense = linkedGroup?.expenses.find(e => e.id === ref.expenseId); return <li key={`${ref.groupId}/${ref.expenseId}`}><Link to={`/tools/bill-splitter?group=${encodeURIComponent(ref.groupId)}&expense=${encodeURIComponent(ref.expenseId)}`}>{expense ? `${expense.title} · ${money(expense.amount, linkedGroup!.currency)}` : 'Rechnung momentan nicht verfügbar'} →</Link><small>{linkedGroup?.name ?? 'Gruppe nicht geladen'}{!expense && ' · gelöscht, offline oder kein Zugriff'}</small><button type="button" className="lt-text-link" disabled={loading} onClick={() => { setMessage(commit(current => ({ ...current, expenseLinks: current.expenseLinks.filter(l => l.groupId !== ref.groupId || l.expenseId !== ref.expenseId) })) ? 'Verknüpfung gelöst.' : 'Verknüpfung konnte nicht gelöst werden.'); }}>Verknüpfung lösen</button></li>; })}</ul>
        {Object.entries(totals).map(([currency, cents]) => <p className="todo-total" key={currency}><span>Verknüpfte Rechnungen</span><strong>{money(cents, currency)}</strong></p>)}
      </section></aside></div>
  </div>;
}

export default function ShoppingLists() {
  const { state, account, save, update, remove, loading } = useLifeTools(), shared = useBillGroups();
  const [params, setParams] = useSearchParams(), [newName, setNewName] = useState(''), [message, setMessage] = useState(''), [remoteRecipes, setRemoteRecipes] = useState<NutritionRecipe[]>([]), [recipeStatus, setRecipeStatus] = useState('');
  const selected = params.get('list'), list = state.shoppingLists.find(l => l.id === selected) ?? (!selected ? state.shoppingLists[0] : undefined);
  const recipes = [...state.nutritionRecipes, ...state.savedMeals.filter(m => !state.nutritionRecipes.some(r => r.id === m.id)).map(m => ({ ...m, servings: 1 })), ...remoteRecipes.filter(r => !state.nutritionRecipes.some(local => local.id === r.id))];
  const groups = [...shared.groups, ...state.groups.filter(g => !shared.groups.some(remote => remote.id === g.id))];
  const select = (id?: string) => { const next = new URLSearchParams(params); if (id) next.set('list', id); else next.delete('list'); setParams(next); };
  useEffect(() => {
    if (account === 'guest') return;
    let live = true;
    void supabase.from('nutrition_recipes').select('id,name,servings,foods,owner_id').order('created_at', { ascending: false }).limit(100).then(({ data, error }) => {
      if (!live) return;
      if (error) setRecipeStatus('Geteilte Rezepte sind derzeit nicht verfügbar. Deine lokalen Rezepte bleiben nutzbar.');
      else setRemoteRecipes((data ?? []).filter(r => r.owner_id !== account && validNutritionRecipe(r)) as NutritionRecipe[]);
    });
    return () => { live = false; };
  }, [account]);
  return <div>
    <div className="todo-list-manager calorie-card"><form className="pt-actions" onSubmit={e => { e.preventDefault(); const created: ShoppingList = { id: crypto.randomUUID(), name: newName.trim(), items: [], expenseLinks: [] }; if (save('shoppingLists', created)) { setNewName(''); select(created.id); setMessage('Einkaufsliste erstellt.'); } else setMessage('Liste konnte nicht gespeichert werden. Bitte Name oder Speichergrenze prüfen.'); }}><label>Neue Einkaufsliste<input required maxLength={100} value={newName} onChange={e => setNewName(e.target.value)} placeholder="z. B. Wocheneinkauf"/></label><button className="calorie-primary" disabled={loading}><Plus size={16}/> Liste erstellen</button></form>
      <div className="todo-list-pills" aria-label="Einkaufsliste auswählen">{state.shoppingLists.map(l => <button type="button" key={l.id} className={list?.id === l.id ? 'active' : ''} aria-pressed={list?.id === l.id} onClick={() => select(l.id)}><ShoppingCart size={14}/>{l.name}<span>{l.items.filter(i => !i.done).length}</span></button>)}</div>
    </div>
    {list && <div className="todo-list-settings"><form key={list.id + list.name} className="pt-actions" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget), name = String(form.get('name') ?? '').trim(); setMessage(update(current => ({ ...current, shoppingLists: current.shoppingLists.map(l => l.id === list.id ? { ...l, name } : l) })) ? 'Liste umbenannt.' : 'Liste konnte nicht umbenannt werden.'); }}><label>Listenname<input name="name" required maxLength={100} defaultValue={list.name}/></label><button className="calorie-secondary" disabled={loading}>Umbenennen</button></form><DeleteAction name={list.name} onDelete={() => { if (remove('shoppingLists', list.id)) { select(); setMessage('Liste und ihre Artikel gelöscht. Die verbundenen Rechnungen bleiben im Bill Splitter.'); } else setMessage('Liste konnte nicht gelöscht werden.'); }}/></div>}
    <p role="status" className="calorie-status">{message || recipeStatus}</p>
    {list ? <ShoppingEditor key={list.id} list={list} groups={groups} recipes={recipes} billError={shared.error} refreshBills={() => void shared.refresh()}/> : <div className="todo-empty calorie-card"><ShoppingCart size={38}/><h3>{selected ? 'Diese Einkaufsliste ist nicht verfügbar' : 'Eine Liste für jeden Einkauf'}</h3><p>{selected ? 'Wähle eine vorhandene Liste aus oder lege eine neue an.' : 'Erstelle eine benannte Liste und fülle sie mit Artikeln oder Rezeptzutaten.'}</p></div>}
  </div>;
}
