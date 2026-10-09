// Developer-only Vite entry: exercises real tools with a guest ledger, no server writes.
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../src/context/authState';
import { createLifeToolsStore } from '../src/data/lifeToolsStorage';
import TodoList from '../src/components/tools/TodoList';
import CalorieTracker from '../src/components/tools/CalorieTracker';
import BillSplitter from '../src/components/tools/BillSplitter';
import '../src/index.css';
import '../src/components/learning/learningTools.css';

const store = createLifeToolsStore(localStorage);
if (!store.read('guest').groups.some(g => g.id === 'qa-shopping-group')) {
  store.save('guest', 'groups', { id: 'qa-shopping-group', name: 'QA Wohngemeinschaft', currency: 'EUR', members: [{ id: 'qa-alice', name: 'Alice' }, { id: 'qa-bob', name: 'Bob' }], expenses: [{ id: 'qa-bill', title: 'Wocheneinkauf Rechnung', date: '2026-10-09', amount: 2400, paidBy: 'qa-alice', shares: { 'qa-alice': 1200, 'qa-bob': 1200 } }], repayments: [] });
}
const unavailable = async () => ({ error: new Error('Guest QA: authentication disabled') });
const auth: AuthContextType = { user: null, profile: null, loading: false, passwordRecovery: false, finishPasswordRecovery: () => {}, refreshProfile: async () => {}, signUp: async () => ({ error: new Error('Guest QA'), needsEmailConfirmation: false }), signIn: unavailable, updateProfile: unavailable, signOut: async () => {} };
createRoot(document.getElementById('root')!).render(<AuthContext.Provider value={auth}><HashRouter><main style={{ maxWidth: 1200, margin: '0 auto', padding: 16, fontFamily: 'Geist Variable, sans-serif' }}><nav style={{ display: 'flex', gap: 16, padding: '12px 0' }}><Link to="/tools/todo-list">ToDo List</Link><Link to="/tools/calorie-tracker?section=recipes">Rezeptbuch</Link><Link to="/tools/bill-splitter?group=qa-shopping-group">Bill Splitter</Link></nav><Routes><Route path="/tools/todo-list" element={<TodoList/>}/><Route path="/tools/calorie-tracker" element={<CalorieTracker/>}/><Route path="/tools/bill-splitter" element={<BillSplitter/>}/><Route path="*" element={<Navigate to="/tools/todo-list" replace/>}/></Routes></main></HashRouter></AuthContext.Provider>);
