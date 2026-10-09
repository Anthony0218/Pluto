import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLifeTools } from '@/hooks/useLifeTools';
import { linkExpense } from '@/data/todoTools';

/** References stay in the personal shopping lists; shared ledger amounts remain authoritative. */
export default function BillShoppingLinks({ groupId, expenseId }: { groupId: string; expenseId: string }) {
  const { state, update, loading } = useLifeTools();
  const [selected, setSelected] = useState(''), [message, setMessage] = useState('');
  const linked = state.shoppingLists.filter(l => l.expenseLinks.some(ref => ref.groupId === groupId && ref.expenseId === expenseId));
  return <details className="todo-bill-links"><summary>Einkaufslisten · {linked.length}</summary>
    {linked.map(list => <div key={list.id} className="pt-actions"><Link to={`/tools/todo-list?section=shopping&list=${encodeURIComponent(list.id)}`}>{list.name} →</Link><button type="button" className="lt-text-link" disabled={loading} onClick={() => { const ok = update(current => ({ ...current, shoppingLists: current.shoppingLists.map(l => l.id === list.id ? { ...l, expenseLinks: l.expenseLinks.filter(ref => ref.groupId !== groupId || ref.expenseId !== expenseId) } : l) })); setMessage(ok ? 'Verknüpfung gelöst.' : 'Verknüpfung konnte nicht gelöst werden.'); }}>Verknüpfung lösen</button></div>)}
    <form className="pt-actions" onSubmit={e => { e.preventDefault(); let found = false; const ok = update(current => ({ ...current, shoppingLists: current.shoppingLists.map(l => { if (l.id !== selected) return l; found = true; return linkExpense(l, { groupId, expenseId }); }) })); setMessage(ok && found ? 'Einkaufsliste verknüpft.' : 'Verknüpfung konnte nicht gespeichert werden.'); if (ok && found) setSelected(''); }}><label>Einkaufsliste<select required value={selected} onChange={e => setSelected(e.target.value)}><option value="">Liste auswählen</option>{state.shoppingLists.filter(l => !linked.some(item => item.id === l.id)).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><button className="lt-button" disabled={loading || !selected}>Verknüpfen</button></form>
    {!state.shoppingLists.length && <Link to="/tools/todo-list?section=shopping">Einkaufsliste erstellen →</Link>}<p role="status">{message}</p>
  </details>;
}
