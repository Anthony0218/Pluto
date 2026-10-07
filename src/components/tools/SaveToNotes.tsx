import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, NotebookPen } from 'lucide-react';
import { noteTitle, resultBlock, sortNotes } from '@/data/notes';
import { useNotes } from '@/hooks/useNotes';
import { ui, useUiLanguage } from '@/i18n/ui';
import './notes.css';

/** Offered next to a calculation: keeps its heading and lines in a new note, or at the end of one the person already has. */
export default function SaveToNotes({ heading, lines }: { heading: string; lines: readonly string[] }) {
  useUiLanguage();
  const { notes, loading, append } = useNotes();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('new');
  // What happened is remembered with the result it was for: a different result is a different thing to keep.
  const [outcome, setOutcome] = useState<{ key: string; id: string | null } | null>(null);
  const panel = useId();
  const key = `${heading}\n${lines.join('\n')}`;
  const saved = outcome?.key === key ? outcome.id : null;
  const failed = outcome?.key === key && !outcome.id;
  const choices = sortNotes(notes);
  const save = () => {
    const id = append(target === 'new' ? null : target, [resultBlock(heading, lines)], heading);
    setOutcome({ key, id });
    if (id) { setOpen(false); setTarget('new'); }
  };
  return <div className="save-note">
    <button type="button" className="save-note-toggle" aria-expanded={open} aria-controls={panel} disabled={loading} onClick={() => setOpen(value => !value)}>
      {saved ? <Check size={16} aria-hidden /> : <NotebookPen size={16} aria-hidden />}{ui(saved ? 'Saved to Notes' : 'Save to Notes')}
    </button>
    {saved && !open && <Link className="lt-text-link" to={`/tools/notes?note=${encodeURIComponent(saved)}`}>{ui('Open Notes')}</Link>}
    {open && <div id={panel} className="save-note-panel">
      <label>{ui('Save in')}
        <select value={choices.some(note => note.id === target) ? target : 'new'} onChange={event => setTarget(event.target.value)}>
          <option value="new">{ui('New note')}</option>
          {choices.map(note => <option key={note.id} value={note.id}>{noteTitle(note) || ui('Untitled note')}</option>)}
        </select>
      </label>
      <button type="button" className="lt-button primary" onClick={save}>{ui('Save')}</button>
      {failed && <p role="alert" className="pt-error">{ui('Could not save. Check that browser storage is available.')}</p>}
    </div>}
  </div>;
}
