import { useRef, useState, type KeyboardEvent } from 'react';
import { CheckCheck, ListTodo, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useTodoKeyboard } from '@/hooks/useTodoKeyboard';
import { useLifeTools } from '@/hooks/useLifeTools';
import { reviseTodo, type Todo, type TodoContent } from '@/data/todoTools';
import { localToday } from '@/data/lifeToolsBrowser';

const blank = (): TodoContent => ({ title: '', notes: '', priority: 'normal', dueDate: '', done: false, deleted: false });
const stamp = (at: number) => new Date(at).toLocaleString('de-DE');
export default function TodoBoard() {
  const { state, save, loading } = useLifeTools();
  const [filter, setFilter] = useState<'open' | 'done' | 'all' | 'trash'>('open');
  const [query, setQuery] = useState(''), [draft, setDraft] = useState(blank), [editing, setEditing] = useState<string | null>(null), [message, setMessage] = useState('');
  const titleInput = useRef<HTMLInputElement>(null), searchInput = useRef<HTMLInputElement>(null);
  const active = state.todos.filter(t => !t.deleted), done = active.filter(t => t.done).length;
  const shown = state.todos.filter(todo => (filter === 'trash' ? todo.deleted : !todo.deleted && (filter === 'all' || todo.done === (filter === 'done'))) && [todo, ...todo.history].some(r => `${r.title} ${r.notes}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))).sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high') || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.createdAt - a.createdAt);
  const reset = () => { setDraft(blank()); setEditing(null); };
  const change = (todo: Todo, changes: Partial<TodoContent>) => {
    const ok = save('todos', reviseTodo(todo, changes));
    setMessage(ok ? (changes.deleted ? 'In den Papierkorb verschoben. Dort kannst du das ToDo wiederherstellen.' : 'Änderung gespeichert.') : 'Speichern fehlgeschlagen. Bitte Eingaben oder Speichergrenze prüfen (maximal 200 Änderungen pro ToDo).');
    if (ok && changes.deleted && editing === todo.id) reset();
  };
  const edit = (todo: Todo) => { setEditing(todo.id); setDraft({ title: todo.title, notes: todo.notes, priority: todo.priority, dueDate: todo.dueDate, done: todo.done, deleted: false }); titleInput.current?.focus(); };
  useTodoKeyboard(() => { reset(); titleInput.current?.focus(); }, searchInput);
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement, typing = target.matches('input, textarea, select') || target.isContentEditable;
    if (event.key === 'Escape') { reset(); target.blur(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { const form = target.closest('form'); if (form) { event.preventDefault(); form.requestSubmit(); } return; }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); reset(); titleInput.current?.focus(); }
    if (event.key === '/') { event.preventDefault(); searchInput.current?.focus(); }
  };
  return <div onKeyDown={keyboard}>
    <div className="todo-summary"><article className="calorie-card"><ListTodo size={23}/><strong>{active.length - done}</strong><span>Offene ToDos</span></article><article className="calorie-card"><CheckCheck size={23}/><strong>{done}</strong><span>Erledigt & abrufbar</span></article><article className="todo-summary-tip"><p>Platz für alles, was ansteht.</p><span>Erledigte Aufgaben und frühere Fassungen bleiben gespeichert.</span></article></div>
    <div className="todo-layout">
      <section className="calorie-card todo-panel" aria-label="Deine ToDos">
        <div className="calorie-section-title"><h3>Deine ToDos</h3><span>{shown.length} Einträge</span></div>
        <input ref={searchInput} className="todo-search" type="search" aria-label="ToDos und Änderungsverlauf durchsuchen" placeholder="ToDos & frühere Fassungen suchen …" value={query} onChange={e => setQuery(e.target.value)} aria-keyshortcuts="/" />
        <div className="todo-filters" aria-label="ToDos filtern">{([{ id: 'open', label: 'Offen' }, { id: 'done', label: 'Erledigt' }, { id: 'all', label: 'Alle' }, { id: 'trash', label: 'Papierkorb' }] as const).map(f => <button type="button" key={f.id} className={filter === f.id ? 'active' : ''} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div>
        <ul className="todo-items">{shown.map(todo => <li key={todo.id} className={`todo-row ${todo.done ? 'is-done' : ''}`}>
          <div className="todo-row-main" tabIndex={0} aria-label={`${todo.title}${todo.done ? ', erledigt' : ''}`} onKeyDown={event => {
            if ((event.target as HTMLElement).matches('input,textarea,select') || event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const rows = [...event.currentTarget.closest('ul')!.querySelectorAll<HTMLElement>('.todo-row-main')], index = rows.indexOf(event.currentTarget); rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
            if (event.target === event.currentTarget && event.key === ' ') { event.preventDefault(); if (!todo.deleted) change(todo, { done: !todo.done }); }
            if (event.key.toLowerCase() === 'e' && !todo.deleted) { event.preventDefault(); edit(todo); }
            if (event.key === 'Delete' && !todo.deleted) { event.preventDefault(); change(todo, { deleted: true }); }
          }}>
            {!todo.deleted && <input type="checkbox" checked={todo.done} disabled={loading} aria-label={`${todo.title} erledigt`} onChange={e => change(todo, { done: e.target.checked })}/>}
            <div className="todo-content"><strong>{todo.title}</strong>{todo.notes && <p>{todo.notes}</p>}<div className="todo-meta">{todo.priority === 'high' && <span className="todo-badge">Wichtig</span>}{todo.dueDate && <span className={!todo.done && todo.dueDate < localToday() ? 'todo-overdue' : ''}>Fällig: {todo.dueDate}</span>}<span>{todo.history.length ? `Bearbeitet · ${stamp(todo.updatedAt)}` : `Erstellt · ${stamp(todo.createdAt)}`}</span></div></div>
            <div className="todo-row-actions">{todo.deleted ? <button type="button" className="calorie-secondary" disabled={loading} onClick={() => change(todo, { deleted: false })}><RotateCcw size={15}/> Wiederherstellen</button> : <><button type="button" className="calorie-icon-button" aria-label={`${todo.title} bearbeiten`} onClick={() => edit(todo)}><Pencil size={16}/></button><button type="button" className="calorie-icon-button" disabled={loading} aria-label={`${todo.title} löschen`} onClick={() => change(todo, { deleted: true })}><Trash2 size={16}/></button></>}</div>
          </div>
          <details className="todo-history"><summary>Änderungsverlauf · {todo.history.length + 1} Fassungen</summary><ol>{[...todo.history, { ...todo, at: todo.updatedAt }].map((revision, index) => <li key={index}><small>{stamp(revision.at)} · {index === todo.history.length ? 'Aktuell' : 'Frühere Fassung'} · {revision.deleted ? 'Gelöscht' : revision.done ? 'Erledigt' : 'Offen'}</small><strong>{revision.title}</strong>{revision.notes && <p>{revision.notes}</p>}<p>{revision.priority === 'high' ? 'Wichtig' : 'Normal'}{revision.dueDate && ` · Fällig: ${revision.dueDate}`}</p>{index < todo.history.length && <button type="button" className="calorie-secondary" disabled={loading} onClick={() => change(todo, { title: revision.title, notes: revision.notes, priority: revision.priority, dueDate: revision.dueDate, done: revision.done, deleted: false })}>Diese Fassung wiederherstellen</button>}</li>)}</ol></details>
        </li>)}</ul>
        {!shown.length && <div className="todo-empty"><ListTodo size={32}/><h4>{query ? 'Keine passenden ToDos' : filter === 'done' ? 'Noch keine erledigten ToDos' : filter === 'trash' ? 'Der Papierkorb ist leer' : 'Alles im Blick'}</h4><p>{query ? 'Die Suche berücksichtigt auch frühere Fassungen.' : 'Trage deine nächste Aufgabe ein. Mit N springst du zum Eingabefeld.'}</p></div>}
      </section>
      <aside className="calorie-card todo-panel"><span className="calorie-label">Dein nächster Schritt</span><h3>{editing ? 'ToDo bearbeiten' : 'Neues ToDo'}</h3><form className="todo-form" onSubmit={e => { e.preventDefault(); const previous = state.todos.find(t => t.id === editing), now = Date.now(); if (editing && (!previous || previous.deleted)) { setMessage('Dieses ToDo wurde inzwischen gelöscht. Bitte im Papierkorb prüfen.'); return; } const next = previous ? reviseTodo(previous, { ...draft, title: draft.title.trim() }) : { ...draft, title: draft.title.trim(), id: crypto.randomUUID(), createdAt: now, updatedAt: now, history: [] }; if (save('todos', next)) { reset(); setMessage(previous ? 'ToDo aktualisiert. Die frühere Fassung bleibt im Verlauf.' : 'ToDo hinzugefügt.'); titleInput.current?.focus(); } else setMessage('Speichern fehlgeschlagen. Bitte Eingaben oder Speichergrenze prüfen (maximal 200 Änderungen pro ToDo).'); }}>
        <label>Aufgabe<input ref={titleInput} required maxLength={100} value={draft.title} placeholder="z. B. Wochenende planen" onChange={e => setDraft({ ...draft, title: e.target.value })} aria-keyshortcuts="N" /></label>
        <label>Notizen<textarea rows={3} maxLength={2000} value={draft.notes} placeholder="Details, die du nicht vergessen möchtest" onChange={e => setDraft({ ...draft, notes: e.target.value })}/></label>
        <div className="calorie-two"><label>Priorität<select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as TodoContent['priority'] })}><option value="normal">Normal</option><option value="high">Wichtig</option></select></label><label>Fällig am<input type="date" min="2000-01-01" max="2099-12-31" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })}/></label></div>
        <div className="calorie-form-actions"><button className="calorie-primary" disabled={loading}><Plus size={16}/>{editing ? 'Änderungen speichern' : 'ToDo hinzufügen'}</button>{editing && <button type="button" className="calorie-secondary" onClick={reset}>Abbrechen</button>}</div>
      </form><p role="status" className="calorie-status">{message}</p><details className="todo-shortcuts"><summary>Tastatursteuerung</summary><p><kbd>N</kbd> Neue Aufgabe · <kbd>/</kbd> Suche</p><p><kbd>↑</kbd> <kbd>↓</kbd> Aufgaben auswählen</p><p><kbd>E</kbd> Bearbeiten · <kbd>Leertaste</kbd> Abhaken</p><p><kbd>Entf</kbd> Papierkorb · <kbd>Esc</kbd> Abbrechen</p><p><kbd>⌘ / Strg + Enter</kbd> Formular speichern</p><small>Einzeltasten gelten außerhalb von Eingabefeldern. Zeilenaktionen gelten auf der ausgewählten Aufgabe.</small></details></aside>
    </div>
  </div>;
}
