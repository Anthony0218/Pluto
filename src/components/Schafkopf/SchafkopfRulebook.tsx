import { useState, type ReactNode } from 'react';
import rules from '../../games/schafkopf/docs/teil1.md?raw';
import tips from '../../games/schafkopf/docs/teil2.md?raw';
import additions from '../../games/schafkopf/docs/teil2b.md?raw';
import clarifications from '../../games/schafkopf/docs/klarstellungen-2026-10-05.md?raw';
import { SCHAFKOPF_LESSONS } from '../../games/schafkopf/lessons';
const documents = [{title:'Teil 1 · Regeln',text:rules},{title:'Teil 2 · Tipps',text:tips},{title:'Teil 2b · Bot-Einstellungen und Ergänzungen',text:additions}];
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part,index) => part.startsWith('**') ? <strong key={index}>{part.slice(2,-2)}</strong> : part.startsWith('`') ? <code key={index}>{part.slice(1,-1)}</code> : part.startsWith('*') ? <em key={index}>{part.slice(1,-1)}</em> : part);
}
/** Deliberately renders Markdown as text/React elements; documents cannot inject HTML. */
function Markdown({text}: {text:string}) {
  const lines = text.split('\n'), nodes: ReactNode[] = [];
  for (let i=0;i<lines.length;i++) {
    const line = lines[i].trim(); if (!line) continue;
    if (line.startsWith('```')) {
      const code: string[] = []; const key=i;
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
      nodes.push(<pre key={key}>{code.join('\n')}</pre>); continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][]=[]; const key=i;
      do { if (!/^\|[\s:|-]+\|$/.test(lines[i])) rows.push(lines[i].trim().slice(1,-1).split('|').map(cell => cell.trim())); i++; } while (i<lines.length && lines[i].trim().startsWith('|'));
      i--; nodes.push(<div className="sk-source-table" key={key}><table><thead><tr>{rows[0].map((cell,index) => <th key={index}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.slice(1).map((row,index) => <tr key={index}>{row.map((cell,column) => <td key={column}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) { nodes.push(heading[1].length <= 2 ? <h3 key={i}>{inline(heading[2])}</h3> : <h4 key={i}>{inline(heading[2])}</h4>); continue; }
    if (line === '---') { nodes.push(<hr key={i}/>); continue; }
    if (line.startsWith('>')) { nodes.push(<blockquote key={i}>{inline(line.replace(/^>\s?/,''))}</blockquote>); continue; }
    const bullet=line.match(/^(\s*)(?:[-*]|\d+\.)\s+(.+)/);
    if (bullet) { nodes.push(<p className="sk-source-bullet" key={i}>• {inline(bullet[2])}</p>); continue; }
    nodes.push(<p key={i}>{inline(line)}</p>);
  }
  return <div className="sk-rule-source">{nodes}</div>;
}
export default function SchafkopfRulebook() {
  const [query,setQuery] = useState('');
  const lessons = SCHAFKOPF_LESSONS.filter(lesson => `${lesson.code} ${lesson.title} ${lesson.text}`.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')));
  return <div className="sk-document-rulebook">
    <h3>Dein Regelwerk · Regeln, Tipps und Bot-Verhalten</h3>
    <p>Die drei Originaldokumente sind vollständig übernommen. Deine Klarstellungen vom 5. Oktober 2026 haben bei Abweichungen Vorrang. Noch offene Details sind im aktuellen Regelstand gekennzeichnet.</p>
    <details className="sk-rule-document" open><summary>Aktuelle Klarstellungen · 5. Oktober 2026</summary><a download="schafkopf-klarstellungen-2026-10-05.md" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(clarifications)}`}>Aktuellen Regelstand herunterladen</a><Markdown text={clarifications}/></details>
    <label className="sk-rule-search">Regeln und Tipps suchen<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Zum Beispiel R6, Schmieren oder Bremser" /></label>
    <div className="sk-lesson-index">{lessons.map(lesson => <details key={lesson.id}><summary><b>{lesson.code}</b> · {lesson.title} <small>{lesson.kind === 'rule' ? 'Regel' : 'Tipp'}</small></summary><p>{lesson.text}</p></details>)}{!lessons.length && <p>Keine passenden Regeln oder Tipps.</p>}</div>
    {documents.map(document => <details className="sk-rule-document" key={document.title}><summary>{document.title} · vollständiges Original</summary><a download={`${document.title.split(' · ')[0].replaceAll(' ','-')}.md`} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(document.text)}`}>Originaldatei herunterladen</a><Markdown text={document.text}/></details>)}
  </div>;
}
