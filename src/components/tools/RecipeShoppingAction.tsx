import './todoList.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useLifeTools } from '@/hooks/useLifeTools';
import { portionNumber, type NutritionRecipe } from '@/data/calorieTools';
import { addRecipeToList, type ShoppingList } from '@/data/todoTools';

export default function RecipeShoppingAction({ recipe, listId }: { recipe: NutritionRecipe; listId?: string }) {
  const { state, update, loading } = useLifeTools();
  const [selected, setSelected] = useState(listId ?? ''), [servings, setServings] = useState(String(recipe.servings)), [name, setName] = useState(''), [message, setMessage] = useState(''), [savedId, setSavedId] = useState('');
  const target = listId ?? selected;
  return <details className="todo-recipe-action"><summary><ShoppingCart size={15}/> Auf Einkaufsliste</summary><form className="todo-form" onSubmit={e => {
    e.preventDefault(); const count = portionNumber(servings), newId = crypto.randomUUID();
    if (!count || count > 100) { setMessage('Bitte zwischen 0,01 und 100 Portionen eingeben.'); return; }
    let imported = false;
    const ok = update(current => {
      const list: ShoppingList | undefined = target ? current.shoppingLists.find(l => l.id === target) : { id: newId, name: name.trim() || `Einkauf: ${recipe.name}`.slice(0, 100), items: [], expenseLinks: [] };
      if (!list) return current;
      const next = addRecipeToList(list, recipe, count);
      if (!next) return current;
      imported = true;
      return { ...current, shoppingLists: [...current.shoppingLists.filter(l => l.id !== next.id), next] };
    });
    if (ok && imported) { setSavedId(target || newId); setMessage('Zutaten hinzugefügt. Gleiche offene Zutaten mit derselben Einheit wurden zusammengefasst.'); }
    else { setSavedId(''); setMessage('Zutaten konnten nicht gespeichert werden. Bitte Liste, Mengen und Speichergrenzen prüfen.'); }
  }}>
    {!listId && <label>Einkaufsliste<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Neue Einkaufsliste</option>{state.shoppingLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
    {!target && <label>Name der neuen Liste<input maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder={`Einkauf: ${recipe.name}`}/></label>}
    <label>Gewünschte Portionen<input required inputMode="decimal" value={servings} onChange={e => setServings(e.target.value)}/></label>
    <button className="calorie-primary" disabled={loading}>Zutaten hinzufügen</button>
    <p role="status" className="calorie-status">{message}</p>{savedId && <Link className="lt-text-link" to={`/tools/todo-list?section=shopping&list=${encodeURIComponent(savedId)}`}>Einkaufsliste öffnen →</Link>}
  </form></details>;
}
