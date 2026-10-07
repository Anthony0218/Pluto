import { useState, type ReactNode } from 'react';
import { ui } from '@/i18n/ui';
import { currencies, type Currency } from '@/data/lifeTools';
import './practicalTools.css';
import './lifeTools.css';
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label>{ui(label)}{children}</label>; }
export function CurrencyField({ value, onChange }: { value: Currency; onChange: (value: Currency) => void }) { return <Field label="Currency"><select value={value} onChange={e => onChange(e.target.value as Currency)}>{currencies.map(c => <option key={c}>{c}</option>)}</select></Field>; }
export function StorageNote({ sessionOnly }: { sessionOnly: boolean }) { return <p className="lt-storage-note">{ui(sessionOnly ? 'Storage is unavailable. Your tools stay available only for this session.' : 'Saved in this browser, separately for each account. Enabled planner and birthday reminders can be shared through background reminder settings.')}</p>; }
export function DeleteAction({ onDelete, name }: { onDelete: () => void; name: string }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? <span className="life-delete"><span>{ui('Delete this saved item?')}</span><button type="button" className="lt-button" onClick={() => { onDelete(); setConfirm(false); }}>{ui('Delete')}</button><button type="button" className="lt-button" onClick={() => setConfirm(false)}>{ui('Cancel')}</button></span> : <button type="button" className="lt-text-link" aria-label={`${ui('Delete')}: ${name}`} onClick={() => setConfirm(true)}>{ui('Delete')}</button>;
}
