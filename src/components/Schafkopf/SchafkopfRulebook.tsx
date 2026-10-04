import { useState, type ReactNode } from 'react';
import rules from '../../games/schafkopf/docs/teil1.md?raw';
import tips from '../../games/schafkopf/docs/teil2.md?raw';
import additions from '../../games/schafkopf/docs/teil2b.md?raw';
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
    <p>Die drei Originaldokumente sind vollständig übernommen. Widersprüche zu bisherigen Tischregeln sind zur Klärung markiert; bis dahin gelten dort die bisherigen Einstellungen.</p>
    <details className="sk-pending-rules"><summary>Abweichungen zur bisherigen App · Klärung ausstehend</summary><ul>
      <li>Bieten: bisher getrennte Spielränge, Tout im Bieten und zweiter Spieler zuerst; Dokument: Wenz = Geier = Solo, erster Spieler zuerst, Tout erst nach dem Bieten.</li>
      <li>Spritzen: bisher Kontra zur ersten eigenen Karte sowie Re/Sub/Hirsch im Folgestich mit festen 61/60-Grenzen; Dokument: Kontra vor der ersten Karte, Re vor dem nächsten eigenen Zug und 61/31 für die letzte Spritzerpartei.</li>
      <li>Davonlaufen: bisher Sau beim Bedienen weiter verpflichtend; Dokument: nach Davonlaufen frei wählbar.</li>
      <li>Laufende: bisher höchstens 8 im Farbsolo; Dokument beschreibt die ganze Trumpffolge.</li>
      <li>Sie: bisher vierfaches Solo; Dokument: vierfaches Solo-Tout.</li>
      <li>Schwarz: bisher zusätzlich zu Schneider; Dokument nennt einen Zuschlag statt Schneider. Bei den Standardtarifen ergibt beides insgesamt +20.</li>
      <li>T9: feste R3-Ausnahme oder Trefferquote laut Tippmatrix? Aktuell gilt die feste Ausnahme bei bewiesener Trumpflosigkeit.</li>
      <li>Tout: bisher immer zu Ende spielen. Sofortiger Abbruch ist jetzt optional unter „Regeln anpassen“ verfügbar.</li>
      <li>R4a, R2/T11 und A4-Ausschlusskriterien enthalten Präzisierungen mit dokumentierten technischen Defaults. Die genaue Schwarz-Gefahr-Schwelle und die grobe Punktkenntnis von Fortgeschritten sind noch offen.</li>
      <li>Hochzeit: bisher nur ein Einstellschalter, keine spielbare Engine-Variante. Das Dokument setzt eine vorhandene Implementierung voraus.</li>
    </ul></details>
    <details className="sk-pending-rules"><summary>Zusätzliche weiterhin geltende Tischregeln</summary><ul>
      <li>Eichel-Ober-Pflichtspiel nach viermal Weiter, falls aktiviert. Bei einem erzwungenen Ruf gehen fehlende Sauen vor; sonst können Zehn, König, Neun, Acht oder Sieben gerufen werden.</li>
      <li>Der letzte Klopfer muss nach viermal Weiter spielen. Die Entscheidung gibt die zweite Viererhand sofort frei; jede Klopfentscheidung verdoppelt den Tarif.</li>
      <li>Ramsch: Eine Jungfrau ohne Stich bekommt eine doppelte Gewinnzahlung. Bei gleichen höchsten Augen verliert bisher der früheste Sitz.</li>
      <li>Bettel hat keinen Trumpf, der Ansager gewinnt ohne eigenen Stich. Farbwenz und Farbgeier zählen Laufende bisher ab drei.</li>
      <li>Online: 20 Sekunden Klopfzeit und 60 Sekunden Zugzeit. Einzelspieler: Legen immer aktiv und ohne Entscheidungsfrist.</li>
      <li>Wenz/Geier-Bots behalten die zusätzliche bisherige Mindeststärke: alle vier Rangtrümpfe oder die höchsten drei und ein Fehlfarben-Ass.</li>
    </ul></details>
    <label className="sk-rule-search">Regeln und Tipps suchen<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Zum Beispiel R6, Schmieren oder Bremser" /></label>
    <div className="sk-lesson-index">{lessons.map(lesson => <details key={lesson.id}><summary><b>{lesson.code}</b> · {lesson.title} <small>{lesson.kind === 'rule' ? 'Regel' : 'Tipp'}</small></summary><p>{lesson.text}</p></details>)}{!lessons.length && <p>Keine passenden Regeln oder Tipps.</p>}</div>
    {documents.map(document => <details className="sk-rule-document" key={document.title}><summary>{document.title} · vollständiges Original</summary><a download={`${document.title.split(' · ')[0].replaceAll(' ','-')}.md`} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(document.text)}`}>Originaldatei herunterladen</a><Markdown text={document.text}/></details>)}
  </div>;
}
