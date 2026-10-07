import useToolPushBridge from '@/hooks/useToolPush';
import { Link } from 'react-router-dom';
import { useLifeTools } from '@/hooks/useLifeTools';
import { useToolClock } from '@/hooks/useToolClock';
import { dueBirthdays } from '@/data/birthdayTools';
import { zonedParts } from '@/data/lifeTools';
import { dueTasks } from '@/data/lifeTools';
import { ui, useUiLanguage } from '@/i18n/ui';
import './lifeTools.css';
export default function ToolReminders() {
  useUiLanguage();
  useToolPushBridge();
  const { state, update, loading } = useLifeTools();
  const fastClock = state.breaks.enabled || state.tasks.some(t => t.reminder && !t.done && !t.reminded);
  const now = useToolClock(fastClock || state.birthdays.some(p => p.reminder), fastClock ? 500 : 60000);
  if (loading) return null;
  const birthdays = dueBirthdays(state.birthdays, now);
  const tasks = dueTasks(state.tasks, now), breakDue = state.breaks.enabled && state.breaks.nextAt <= now;
  if (!tasks.length && !birthdays.length && !breakDue) return null;
  return <aside className="life-reminders" aria-label={ui('In-app reminders')}><div role="status" aria-live="polite">
    {birthdays.slice(0, 3).map(person => <div key={`birthday-${person.id}`} className="life-reminder"><strong>{ui('Birthday reminder')}</strong><p>{person.name} · {ui('Birthday today!')}</p><div className="pt-actions"><Link to="/tools/birthday-reminders">{ui('Birthday Reminders')}</Link><button className="lt-button" type="button" onClick={() => update(s => ({ ...s, birthdays: s.birthdays.map(p => p.id === person.id ? { ...p, dismissedYear: Number(zonedParts(now, p.zone).date.slice(0, 4)) } : p) }))}>{ui('Dismiss')}</button></div></div>)}
    {birthdays.length > 3 && <Link to="/tools/birthday-reminders">{ui('See all birthdays')}</Link>}
    {tasks.slice(0, 3).map(task => <div key={task.id} className="life-reminder"><strong>{ui('Task reminder')}</strong><p>{task.title}</p><div className="pt-actions"><Link to="/tools/day-planner">{ui('Day Planner')}</Link><button className="lt-button" type="button" onClick={() => update(s => ({ ...s, tasks: s.tasks.map(t => t.id === task.id ? { ...t, reminded: true } : t) }))}>{ui('Dismiss')}</button></div></div>)}
    {tasks.length > 3 && <p>{ui('More due tasks are listed in Day Planner.')}</p>}
    {breakDue && <div className="life-reminder"><strong>{ui('Time for a break')}</strong><p>{ui('Stand up, move, or rest your eyes when it suits you.')}</p><div className="pt-actions"><button className="lt-button" type="button" onClick={() => update(s => ({ ...s, breaks: { ...s.breaks, nextAt: Date.now() + s.breaks.interval * 60000 } }))}>{ui('Dismiss')}</button><button className="lt-button" type="button" onClick={() => update(s => ({ ...s, breaks: { ...s.breaks, enabled: false } }))}>{ui('Turn off')}</button></div></div>}
  </div></aside>;
}
