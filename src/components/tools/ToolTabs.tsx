import { useId } from 'react';
import { ui } from '@/i18n/ui';
export default function ToolTabs<T extends string>({ tabs, value, onChange, label, panelId }: { tabs: readonly T[]; value: T; onChange: (value: T) => void; label: string; panelId: string }) {
  const id = useId();
  return <nav className="life-tabs" role="tablist" aria-label={ui(label)}>{tabs.map((tab, index) => <button key={tab} id={`${id}-${index}`} type="button" role="tab" aria-controls={panelId} aria-selected={value === tab} tabIndex={value === tab ? 0 : -1} onClick={() => onChange(tab)} onKeyDown={e => {
    const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (next !== -1) { e.preventDefault(); onChange(tabs[next]); (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus(); }
  }}>{ui(tab)}</button>)}</nav>;
}
