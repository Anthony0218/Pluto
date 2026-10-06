import { useMemo, useState } from 'react';
import { Gift } from 'lucide-react';
import { useLifeTools } from '@/hooks/useLifeTools';
import { useToolClock } from '@/hooks/useToolClock';
import { birthdayDate, nextBirthday, type BirthdayPerson } from '@/data/birthdayTools';
import { validZone, zonedParts } from '@/data/lifeTools';
import { ui, useUiLanguage } from '@/i18n/ui';
import { DeleteAction, Field, StorageNote } from './LifeToolParts';
import ToolNotificationSettings from './ToolNotificationSettings';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function Birthdays() {
  useUiLanguage();
  const { state, save, remove, loading, sessionOnly } = useLifeTools();
  const now = useToolClock(true, 60000);
  const [name, setName] = useState(''), [month, setMonth] = useState(1), [day, setDay] = useState(1), [birthYear, setBirthYear] = useState('');
  const [zone, setZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone), [reminder, setReminder] = useState(true), [editing, setEditing] = useState<string | null>(null), [message, setMessage] = useState('');
  const maxDay = new Date(Date.UTC(birthYear ? Number(birthYear) : 2000, month, 0)).getUTCDate();
  const rows = useMemo(() => state.birthdays.map(person => ({ person, next: nextBirthday(person, now) })).sort((a, b) => (a.next?.at ?? Infinity) - (b.next?.at ?? Infinity) || a.person.name.localeCompare(b.person.name)), [state.birthdays, now]);
  const reset = () => { setName(''); setMonth(1); setDay(1); setBirthYear(''); setEditing(null); setMessage(''); setReminder(true); };
  const edit = (person: BirthdayPerson) => { setName(person.name); setMonth(person.month); setDay(person.day); setBirthYear(person.birthYear?.toString() ?? ''); setZone(person.zone); setReminder(person.reminder); setEditing(person.id); setMessage(''); };
  return <section className="pt-workbench" aria-label={ui('Birthday Reminders')}>
    <p className="lt-notice">{ui('Reminders repeat every year at 09:00 in the selected time zone. February 29 birthdays are celebrated on February 28 in other years.')}</p>
    {state.background.enabled && <p className="lt-storage-note">{ui('Background reminders are enabled. Saving a person with reminders on shares their name, birthday month and day, and time zone with your reminder service. Birth years stay in this browser.')}</p>}
    <div className="life-workspace"><div>
      <h2>{ui('Upcoming birthdays')}</h2>
      {!rows.length && <p className="lt-storage-note">{ui('Add a person to remember their next birthday.')}</p>}
      <ul className="life-list">{rows.map(({ person, next }) => {
        const today = zonedParts(now, person.zone).date;
        const days = next ? Math.round((Date.parse(`${next.date}T12:00Z`) - Date.parse(`${today}T12:00Z`)) / 86400000) : null;
        return <li className="life-row" key={person.id}><div><strong><Gift size={16} aria-hidden="true" /> {person.name}</strong><p>{ui(months[person.month - 1])} {person.day}{person.birthYear === undefined ? '' : ` · ${person.birthYear}`}</p><p>{days === 0 ? ui('Birthday today!') : next ? `${next.date} · ${days} ${ui('days away')}` : ui('No upcoming date available')}{next?.age !== null && next?.age !== undefined && ` · ${ui('Turning')} ${next.age}`}</p><small>{person.zone} · {ui(person.reminder ? 'Reminders on' : 'Reminders off')}</small></div><div className="pt-actions"><button type="button" className="lt-text-link" onClick={() => edit(person)}>{ui('Edit')}</button><DeleteAction name={person.name} onDelete={() => { remove('birthdays', person.id); if (editing === person.id) reset(); }} /></div></li>;
      })}</ul>
    </div><aside><h3>{ui(editing ? 'Edit person' : 'Add person')}</h3>
      <form className="life-form" onSubmit={event => {
        event.preventDefault();
        const previous = state.birthdays.find(p => p.id === editing);
        const unchangedDate = previous?.month === month && previous.day === day && previous.zone === zone;
        const person: BirthdayPerson = { id: editing ?? crypto.randomUUID(), name: name.trim(), month, day, ...(birthYear ? { birthYear: Number(birthYear) } : {}), zone, reminder, ...(unchangedDate && previous.dismissedYear !== undefined ? { dismissedYear: previous.dismissedYear } : {}) };
        if (!validZone(zone) || day > maxDay || (birthYear && birthdayDate(person, Number(birthYear)) > zonedParts(now, zone).date) || !save('birthdays', person)) setMessage('Could not save. Check the inputs or storage limits.');
        else { reset(); setMessage('Saved.'); }
      }}>
        <Field label="Person name"><input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></Field>
        <div className="pt-inputs"><Field label="Birth month"><select value={month} onChange={e => { const month = Number(e.target.value); setMonth(month); setDay(value => Math.min(value, new Date(Date.UTC(birthYear ? Number(birthYear) : 2000, month, 0)).getUTCDate())); }}>{months.map((m, i) => <option key={m} value={i + 1}>{ui(m)}</option>)}</select></Field><Field label="Birth day"><select value={day} onChange={e => setDay(Number(e.target.value))}>{Array.from({ length: maxDay }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></Field></div>
        <Field label="Birth year (optional)"><input type="number" min={1900} max={new Date(now).getFullYear()} step={1} value={birthYear} onChange={e => { const value = e.target.value; setBirthYear(value); setDay(day => Math.min(day, new Date(Date.UTC(value ? Number(value) : 2000, month, 0)).getUTCDate())); }} /></Field>
        <Field label="Time zone"><input required maxLength={100} value={zone} onChange={e => setZone(e.target.value)} /></Field>
        <label className="life-check"><input type="checkbox" checked={reminder} onChange={e => setReminder(e.target.checked)} />{ui('Remind me each year')}</label>
        <div className="pt-actions"><button className="lt-button primary" disabled={loading}>{ui(editing ? 'Save changes' : 'Add person')}</button>{editing && <button type="button" className="lt-button" onClick={reset}>{ui('Cancel')}</button>}</div>
      </form><p role="status">{ui(message)}</p>
    </aside></div>
    <details><summary>{ui('Reminder settings')}</summary><p className="lt-notice">{ui('Birthday reminders appear while Pluto is open. Enable background reminders to receive them when the page is closed.')}</p><ToolNotificationSettings /></details>
    <StorageNote sessionOnly={sessionOnly} />
  </section>;
}
export default function BirthdayReminder() { const { account } = useLifeTools(); return <Birthdays key={account} />; }
