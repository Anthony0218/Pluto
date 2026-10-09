import { CheckCheck, ShoppingCart } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useLifeTools } from '@/hooks/useLifeTools';
import { StorageNote } from './LifeToolParts';
import TodoBoard from './TodoBoard';
import ShoppingLists from './ShoppingLists';
import './calorieTracker.css';
import './todoList.css';

function Workspace() {
  const { sessionOnly } = useLifeTools();
  const [params, setParams] = useSearchParams();
  const shopping = params.get('section') === 'shopping';
  return <section className="pt-workbench calorie-workbench todo-workbench" aria-label="ToDo List"><header className="calorie-header"><div><p className="calorie-eyebrow">Planen · Einkaufen · Erledigen</p><h2>Dein Alltag, auf einer Liste.</h2><p>ToDos mit Verlauf. Einkaufslisten mit Rezepten und Rechnungen.</p></div><span className="todo-header-icon">{shopping ? <ShoppingCart size={28}/> : <CheckCheck size={28}/>}</span></header>
    <nav className="calorie-tabs" aria-label="ToDo List Bereiche"><button type="button" className={!shopping ? 'active' : ''} aria-pressed={!shopping} onClick={() => { const next = new URLSearchParams(params); next.delete('section'); setParams(next); }}><CheckCheck size={16}/> ToDos</button><button type="button" className={shopping ? 'active' : ''} aria-pressed={shopping} onClick={() => { const next = new URLSearchParams(params); next.set('section', 'shopping'); setParams(next); }}><ShoppingCart size={16}/> Einkaufslisten</button></nav>
    {shopping ? <ShoppingLists/> : <TodoBoard/>}<StorageNote sessionOnly={sessionOnly}/>
  </section>;
}
export default function TodoList() { const { account } = useLifeTools(); return <Workspace key={account}/>; }
