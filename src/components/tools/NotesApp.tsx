import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Bold, Italic, Palette, Plus, Rows3, Search, Table2, Trash2, Type } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  createNote, createTableBlock, createTextBlock, effectiveStyle, matchesQuery, moveBlock, noteFonts, noteFontIds, noteSizeIds, noteSizes, noteSnippet, noteThemes, noteTitle,
  pageSwatches, readableOn, sortNotes, tableAddColumn, tableAddRow, tableRemoveColumn, tableRemoveRow, tableSetCell, textSwatches, limits,
  type BlockStyle, type Note, type NoteBlock, type NoteFont, type NoteSize, type NoteStyle,
} from '@/data/notes';
import { useNotes } from '@/hooks/useNotes';
import { ui, useUiLanguage } from '@/i18n/ui';
import { DeleteAction } from './LifeToolParts';
import './notes.css';

function ColorField({ label, value, swatches, onChange }: { label: string; value: string; swatches: readonly string[]; onChange: (value: string) => void }) {
  return <fieldset className="notes-color">
    <legend>{ui(label)}</legend>
    <div>
      {swatches.map(swatch => <button type="button" key={swatch} className="notes-swatch" style={{ background: swatch }} aria-label={`${ui(label)} ${swatch}`} aria-pressed={swatch.toLowerCase() === value.toLowerCase()} onClick={() => onChange(swatch)} />)}
      <input type="color" value={value} aria-label={`${ui(label)}: ${ui('Custom colour')}`} onChange={event => onChange(event.target.value)} />
    </div>
  </fieldset>;
}

function FontSelect({ label, value, onChange, inherit }: { label: string; value: NoteFont | ''; onChange: (value: NoteFont | '') => void; inherit?: string }) {
  return <label>{ui(label)}<select value={value} onChange={event => onChange(event.target.value as NoteFont | '')}>
    {inherit && <option value="">{ui(inherit)}</option>}
    {noteFontIds.map(id => <option key={id} value={id} style={{ fontFamily: noteFonts[id].stack }}>{ui(noteFonts[id].name)}</option>)}
  </select></label>;
}
function SizeSelect({ label, value, onChange, inherit }: { label: string; value: NoteSize | ''; onChange: (value: NoteSize | '') => void; inherit?: string }) {
  return <label>{ui(label)}<select value={value} onChange={event => onChange(event.target.value as NoteSize | '')}>
    {inherit && <option value="">{ui(inherit)}</option>}
    {noteSizeIds.map(id => <option key={id} value={id}>{ui(noteSizes[id].name)}</option>)}
  </select></label>;
}

/** The note as a whole: a ready-made look, then font, size and colours. */
function DesignPanel({ style, onChange }: { style: NoteStyle; onChange: (style: NoteStyle) => void }) {
  const set = (change: Partial<NoteStyle>) => onChange({ ...style, ...change });
  return <div className="notes-design">
    <div className="notes-themes" role="group" aria-label={ui('Looks')}>
      {noteThemes.map(theme => {
        const active = theme.style.color === style.color && theme.style.background === style.background && theme.style.accent === style.accent;
        return <button type="button" key={theme.id} aria-pressed={active} className="notes-theme" onClick={() => set(theme.style)} style={{ background: theme.style.background, color: theme.style.color, borderColor: theme.style.accent }}>
          <span style={{ background: theme.style.accent }} aria-hidden />{ui(theme.name)}
        </button>;
      })}
    </div>
    <div className="notes-design-row">
      <FontSelect label="Font" value={style.font} onChange={value => value && set({ font: value })} />
      <SizeSelect label="Text size" value={style.size} onChange={value => value && set({ size: value })} />
    </div>
    <div className="notes-design-row notes-design-colors">
      <ColorField label="Text colour" value={style.color} swatches={textSwatches} onChange={color => set({ color })} />
      <ColorField label="Page colour" value={style.background} swatches={pageSwatches} onChange={background => set({ background })} />
      <ColorField label="Table header colour" value={style.accent} swatches={[...new Set(noteThemes.map(theme => theme.style.accent))]} onChange={accent => set({ accent })} />
    </div>
  </div>;
}

/** What one piece of text or one table may change on its own, and where it sits in the note. */
function BlockTools({ block, note, first, last, onStyle, onMove, onDelete }: { block: NoteBlock; note: NoteStyle; first: boolean; last: boolean; onStyle: (style: BlockStyle | undefined) => void; onMove: (direction: -1 | 1) => void; onDelete: () => void }) {
  const style = block.style ?? {};
  const shown = effectiveStyle(note, style);
  const set = (change: Partial<BlockStyle>) => {
    const next: BlockStyle = { ...style, ...change };
    for (const key of Object.keys(next) as (keyof BlockStyle)[]) if (next[key] === undefined || next[key] === false) delete next[key];
    onStyle(Object.keys(next).length ? next : undefined);
  };
  return <div className="notes-block-tools" role="toolbar" aria-label={ui(block.type === 'table' ? 'Table options' : 'Text options')}>
    <button type="button" aria-label={ui('Bold')} title={ui('Bold')} aria-pressed={!!style.bold} onClick={() => set({ bold: !style.bold })}><Bold size={15} aria-hidden /></button>
    <button type="button" aria-label={ui('Italic')} title={ui('Italic')} aria-pressed={!!style.italic} onClick={() => set({ italic: !style.italic })}><Italic size={15} aria-hidden /></button>
    <select aria-label={ui('Font')} value={style.font ?? ''} onChange={event => set({ font: (event.target.value || undefined) as NoteFont | undefined })}>
      <option value="">{ui('Note font')}</option>
      {noteFontIds.map(id => <option key={id} value={id}>{ui(noteFonts[id].name)}</option>)}
    </select>
    <select aria-label={ui('Text size')} value={style.size ?? ''} onChange={event => set({ size: (event.target.value || undefined) as NoteSize | undefined })}>
      <option value="">{ui('Note size')}</option>
      {noteSizeIds.map(id => <option key={id} value={id}>{ui(noteSizes[id].name)}</option>)}
    </select>
    <label className="notes-inline-color" title={ui('Text colour')}><Palette size={15} aria-hidden /><input type="color" aria-label={ui('Text colour')} value={shown.color} onChange={event => set({ color: event.target.value })} /></label>
    {style.color && <button type="button" className="notes-text-button" onClick={() => set({ color: undefined })}>{ui('Note colour')}</button>}
    <span className="notes-spacer" />
    <button type="button" aria-label={ui('Move up')} title={ui('Move up')} disabled={first} onClick={() => onMove(-1)}><ArrowUp size={15} aria-hidden /></button>
    <button type="button" aria-label={ui('Move down')} title={ui('Move down')} disabled={last} onClick={() => onMove(1)}><ArrowDown size={15} aria-hidden /></button>
    <button type="button" aria-label={ui('Delete block')} title={ui('Delete block')} onClick={onDelete}><Trash2 size={15} aria-hidden /></button>
  </div>;
}

function TextBlockEditor({ block, onChange }: { block: Extract<NoteBlock, { type: 'text' }>; onChange: (text: string) => void }) {
  return <textarea className="notes-text" aria-label={ui('Text')} placeholder={ui('Write something…')} value={block.text} rows={Math.max(2, block.text.split('\n').length)} maxLength={limits.text} onChange={event => onChange(event.target.value)} />;
}

function TableBlockEditor({ block, accent, onChange }: { block: Extract<NoteBlock, { type: 'table' }>; accent: string; onChange: (change: Partial<Extract<NoteBlock, { type: 'table' }>>) => void }) {
  const { rows } = block;
  const columns = rows[0]?.length ?? 0;
  return <div className="notes-table-block" style={{ '--note-header': accent, '--note-header-text': readableOn(accent) } as CSSProperties}>
    <div className="notes-table-scroll">
      <table>
        <tbody>
          {rows.map((row, r) => {
            const Cell = block.header && r === 0 ? 'th' : 'td';
            return <tr key={r}>
              {row.map((cell, c) => <Cell key={c} scope={Cell === 'th' ? 'col' : undefined}>
                <input type="text" value={cell} maxLength={limits.cell} aria-label={`${ui('Row')} ${r + 1}, ${ui('Column')} ${c + 1}`} onChange={event => onChange({ rows: tableSetCell(rows, r, c, event.target.value) })} />
              </Cell>)}
              <td className="notes-table-tool"><button type="button" aria-label={`${ui('Delete row')} ${r + 1}`} title={ui('Delete row')} disabled={rows.length <= 1} onClick={() => onChange({ rows: tableRemoveRow(rows, r) })}>×</button></td>
            </tr>;
          })}
        </tbody>
        <tfoot>
          <tr>
            {rows[0]?.map((_, c) => <td key={c} className="notes-table-tool"><button type="button" aria-label={`${ui('Delete column')} ${c + 1}`} title={ui('Delete column')} disabled={columns <= 1} onClick={() => onChange({ rows: tableRemoveColumn(rows, c) })}>×</button></td>)}
            <td className="notes-table-tool" />
          </tr>
        </tfoot>
      </table>
    </div>
    <div className="notes-table-actions">
      <button type="button" disabled={rows.length >= limits.rows} onClick={() => onChange({ rows: tableAddRow(rows) })}><Plus size={14} aria-hidden />{ui('Add row')}</button>
      <button type="button" disabled={columns >= limits.columns} onClick={() => onChange({ rows: tableAddColumn(rows) })}><Plus size={14} aria-hidden />{ui('Add column')}</button>
      <label><input type="checkbox" checked={block.header} onChange={event => onChange({ header: event.target.checked })} />{ui('Header row')}</label>
    </div>
  </div>;
}

function NoteEditor({ note, onChange, onDelete }: { note: Note; onChange: (note: Note) => void; onDelete: () => void }) {
  const [designing, setDesigning] = useState(false);
  const edit = (change: Partial<Note>) => onChange({ ...note, ...change });
  const editBlock = (id: string, change: Partial<NoteBlock>) => edit({ blocks: note.blocks.map(block => block.id === id ? { ...block, ...change } as NoteBlock : block) });
  const page = { '--note-bg': note.style.background, '--note-fg': note.style.color, '--note-font': noteFonts[note.style.font].stack, '--note-size': `${noteSizes[note.style.size].px}px`, '--note-border': `color-mix(in srgb, ${note.style.color} 28%, transparent)` } as CSSProperties;
  return <article className="notes-editor" aria-label={ui('Note')}>
    <div className="notes-editor-head">
      <button type="button" className="lt-button" aria-expanded={designing} onClick={() => setDesigning(value => !value)}><Palette size={16} aria-hidden />{ui('Design')}</button>
      <DeleteAction onDelete={onDelete} name={noteTitle(note) || ui('Untitled note')} />
    </div>
    {designing && <DesignPanel style={note.style} onChange={style => edit({ style })} />}
    <div className="notes-page" style={page}>
      <input className="notes-title" type="text" aria-label={ui('Title')} placeholder={ui('Title')} value={note.title} maxLength={limits.title} onChange={event => edit({ title: event.target.value })} />
      {note.blocks.map((block, index) => {
        const shown = effectiveStyle(note.style, block.style);
        const look = { fontFamily: noteFonts[shown.font].stack, fontSize: noteSizes[shown.size].px, color: shown.color, fontWeight: shown.bold ? 700 : 400, fontStyle: shown.italic ? 'italic' : 'normal' } satisfies CSSProperties;
        return <section key={block.id} className="notes-block" style={look} aria-label={ui(block.type === 'table' ? 'Table' : 'Text')}>
          <BlockTools block={block} note={note.style} first={index === 0} last={index === note.blocks.length - 1}
            onStyle={style => editBlock(block.id, { style })} onMove={direction => edit({ blocks: moveBlock(note.blocks, block.id, direction) })} onDelete={() => edit({ blocks: note.blocks.filter(item => item.id !== block.id) })} />
          {block.type === 'text'
            ? <TextBlockEditor block={block} onChange={text => editBlock(block.id, { text })} />
            : <TableBlockEditor block={block} accent={note.style.accent} onChange={change => editBlock(block.id, change)} />}
        </section>;
      })}
      {!note.blocks.length && <p className="notes-empty-page">{ui('This note is empty. Add some text or a table below.')}</p>}
    </div>
    <div className="notes-add">
      <button type="button" className="lt-button" disabled={note.blocks.length >= limits.blocks} onClick={() => edit({ blocks: [...note.blocks, createTextBlock()] })}><Type size={16} aria-hidden />{ui('Add text')}</button>
      <button type="button" className="lt-button" disabled={note.blocks.length >= limits.blocks} onClick={() => edit({ blocks: [...note.blocks, createTableBlock()] })}><Table2 size={16} aria-hidden />{ui('Add table')}</button>
    </div>
  </article>;
}

export default function NotesApp() {
  const { language } = useUiLanguage();
  const { notes, save, remove, sessionOnly, loading } = useNotes();
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get('note'));
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => sortNotes(notes), [notes]);
  const visible = useMemo(() => sorted.filter(note => matchesQuery(note, query)), [sorted, query]);
  const current = notes.find(note => note.id === selectedId) ?? sorted[0] ?? null;
  const date = new Intl.DateTimeFormat(language === 'bar' ? 'de-DE' : language, { dateStyle: 'medium' });
  const start = () => { const note = createNote(); if (save(note)) { setSelectedId(note.id); setQuery(''); } };
  return <section className="notes-app" aria-label={ui('Notes')}>
    <aside className="notes-list" aria-label={ui('Your notes')}>
      <button type="button" className="lt-button primary" disabled={loading || notes.length >= limits.notes} onClick={start}><Plus size={16} aria-hidden />{ui('New note')}</button>
      <label className="notes-search"><Search size={15} aria-hidden /><input type="search" aria-label={ui('Search notes')} placeholder={ui('Search notes')} value={query} onChange={event => setQuery(event.target.value)} /></label>
      {visible.length ? <ul>{visible.map(note => <li key={note.id}>
        <button type="button" aria-current={current?.id === note.id ? 'true' : undefined} onClick={() => setSelectedId(note.id)}>
          <span className="notes-dot" style={{ background: note.style.background, borderColor: note.style.accent }} aria-hidden />
          <span className="notes-list-text">
            <strong>{noteTitle(note) || ui('Untitled note')}</strong>
            <small>{noteSnippet(note) || ui('Empty note')}</small>
            <time dateTime={new Date(note.updatedAt).toISOString()}>{date.format(note.updatedAt)}</time>
          </span>
        </button>
      </li>)}</ul>
        : <p className="notes-list-empty">{ui(notes.length ? 'No notes match your search.' : 'No notes yet. Create one, or save a result from the Calculator or Percentage Calculator.')}</p>}
    </aside>
    <div className="notes-main">
      {current
        ? <NoteEditor key={current.id} note={current} onChange={save} onDelete={() => { remove(current.id); setSelectedId(null); }} />
        : <div className="notes-welcome"><Rows3 size={30} aria-hidden /><h2>{ui('Keep your notes and tables here')}</h2><p>{ui('Style them with your own fonts and colours.')}</p></div>}
      <p className="lt-storage-note">{ui(sessionOnly ? 'Storage is unavailable. Your notes stay available only for this session.' : 'Notes are saved in this browser, separately for each account.')}</p>
    </div>
  </section>;
}
