import { useState, type ReactNode } from 'react';
import rules from '../../games/schafkopf/docs/teil1.md?raw';
import tips from '../../games/schafkopf/docs/teil2.md?raw';
import additions from '../../games/schafkopf/docs/teil2b.md?raw';
import clarifications from '../../games/schafkopf/docs/klarstellungen-2026-10-05.md?raw';
import { SCHAFKOPF_LESSON_EXAMPLES } from '../../games/schafkopf/lessonExamples';
import type { Card } from '../../games/schafkopf/schafkopf';
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
export default function SchafkopfRulebook({ section = 'basics', renderCard }: { section?: 'basics' | 'bots' | 'tips' | 'lexicon'; renderCard?: (card: Card) => ReactNode }) {
  const [query,setQuery] = useState('');
  const lessons = SCHAFKOPF_LESSONS.filter(lesson => (section === 'basics' ? lesson.code === 'ENGINE' : section === 'bots' ? lesson.kind === 'rule' && lesson.code !== 'ENGINE' : lesson.kind === 'tip') && `${lesson.code} ${lesson.title} ${lesson.text}`.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')));
  const glossary = [
    ['Eichel-Ober', 'Alter', 'Höchster Trumpf im Sauspiel und Farbsolo.'], ['Gras-Ober', 'Blauer', 'Zweithöchster Ober.'], ['Herz-Ober', 'Roter', 'Dritthöchster Ober.'], ['Schellen-Ober', 'Schellen-Ober', 'Vierter Ober.'],
    ['Eichel-Ass', 'Alte / Oide', 'Die Sau in Eichel.'], ['Gras-Ass', 'Blaue', 'Gras heißt auch Grün oder Blatt.'], ['Herz-Ass', 'Herz-Sau', 'Herz ist im Sauspiel Trumpf und kann nicht gerufen werden.'], ['Schellen-Ass', 'Schellige / Bums / Pumpe', 'Weitere Rufnamen: Kugel-Bauer-Theres und Hundsgfickte.'],
  ];
  if (section === 'lexicon') return <div className="sk-document-rulebook"><p>Die Namen unterscheiden sich regional. „Roter“ bezeichnet hier den Herz-Ober; der eindeutige Kartenname steht immer daneben.</p><div className="sk-glossary-cards">{glossary.map(([id, name, text]) => { const [suit, rank] = id.split('-'); return <article key={id}>{renderCard?.({ id, suit, rank } as Card)}<div><h4>{name}</h4><strong>{id}</strong><p>{text}</p></div></article>; })}</div><dl className="sk-glossary-terms">{[
    ['Augen', 'Die Kartenpunkte; alle 32 Karten zusammen zählen 120 Augen.'], ['Sau / Ass', 'Eine Karte mit 11 Augen.'], ['Schmier / Volle', 'Ass oder Zehn; diese bringen viele Augen in einen Stich.'], ['Trumpf', 'Sticht jede Fehlfarbe; welche Karten Trumpf sind, bestimmt die Spielart.'], ['Fehlfarbe', 'Eine Farbe, die in der aktuellen Spielart kein Trumpf ist.'], ['Suchen / Suchsau', 'Die gerufene Farbe ausspielen, um die Rufsau und damit den Partner sichtbar zu machen.'], ['Bremser', 'Einer der drei höchsten Ober.'], ['Schmieren', 'Eine punktreiche Karte in einen sicheren Partnerstich legen.'], ['Davonlaufen', 'Der Rufsau-Besitzer spielt mit mindestens vier aktuellen Rufkarten eine niedrigere Rufkarte aus.'], ['Schneider / Schwarz', 'Zu wenige Augen / kein einziger gewonnener Stich. Die genauen Grenzen stehen bei den Spielregeln.'], ['Laufende', 'Lückenlose Folge der höchsten Trümpfe in einer Partei.'], ['Klopfen / Legen', 'Verdoppelt den Spielwert vor der Spielansage.'], ['Kontra / Re / Sub / Hirsch', 'Aufeinanderfolgende Spritzansagen; jede verdoppelt den Spielwert.'], ['Tout / Du', 'Der Ansager muss alle acht Stiche gewinnen.'],
  ].map(([name, text]) => <div key={name}><dt>{name}</dt><dd>{text}</dd></div>)}</dl></div>;
  const obligatoryRules = rules.slice(rules.indexOf('## 2.'), rules.indexOf('## 8.'));
  return <div className="sk-document-rulebook">
    {section === 'basics' && <><h3>Ziel und Ablauf</h3><p>Vier Spieler erhalten je acht Karten. In acht Stichen werden 120 Augen verteilt. Die Spielerpartei braucht ohne Spritzen 61 Augen, die Gegenseite 60. Nach Spritzen braucht die zuletzt spritzende Partei 61. Beim Tout zählt jeder Stich, beim Bettel darf der Ansager keinen gewinnen.</p><p>Der Spieler links vom Geber beginnt. Danach spielt der Stichgewinner aus. Die angespielte Farbe oder Trumpf muss bedient werden; wer frei ist, darf abwerfen oder stechen. Es gibt keine allgemeine Pflicht zum Überstechen.</p><h3>Spielarten</h3><p>Sauspiel: Ansager und Besitzer der gerufenen Sau gegen zwei Gegner. Solo, Wenz, Geier, Farbwenz und Farbgeier: einer gegen drei. Im Solo sind Ober, Unter und die Solofarbe Trumpf; im Wenz nur Unter, im Geier nur Ober. Farbwenz und Farbgeier ergänzen die jeweilige Trumpffarbe. Beim Ramsch verliert, wer die meisten Augen sammelt. Sie wird mit allen Obern und Untern sofort gewertet. Zusätzliche Varianten hängen von euren Einstellungen ab; Hochzeit ist derzeit nicht spielbar.</p><details className="sk-rule-document"><summary>Verpflichtende Spielregeln und Wertung im Detail</summary><Markdown text={obligatoryRules}/><Markdown text={clarifications}/></details></>}
    {section === 'bots' && <p>Diese Grundsätze bestimmen das Bot-Verhalten. Menschen dürfen davon abweichen, solange sie die verpflichtenden Spielregeln, insbesondere die Bedienpflicht, beachten.</p>}
    {section === 'bots' && <details className="sk-rule-document"><summary>Vollständige Bot-Regeln und Ergänzungen</summary><Markdown text={rules.slice(rules.indexOf('## 8.'),rules.indexOf('## 11.'))}/><Markdown text={additions}/></details>}
    {section === 'tips' && <p>Alle Tipps mit Kartenbeispielen. Die Beispiele gelten für Sauspiel mit Herz als Trumpf, sofern beim Beispiel kein anderes Spiel genannt ist.</p>}
    <label className="sk-rule-search">{section === 'tips' ? 'Tipps' : 'Regeln'} suchen<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Zum Beispiel Schmieren oder Bremser" /></label>
    <div className="sk-lesson-index">{lessons.map(lesson => { const example = SCHAFKOPF_LESSON_EXAMPLES[lesson.id]; return <details key={lesson.id}><summary><b>{lesson.code}</b> · {lesson.title}</summary><p>{lesson.text}</p>{example && <figure className="sk-lesson-example"><div className="sk-review-cards">{example.cards.map(card => <span key={card.id}>{renderCard?.(card) ?? card.id}</span>)}</div><figcaption>{example.caption}</figcaption></figure>}</details>; })}{!lessons.length && <p>Keine passenden Einträge.</p>}</div>
    {section === 'basics' && <details className="sk-rule-document"><summary>Originaldokumente und aktueller Regelstand</summary><p>Diese Quellen enthalten auch Bot-Vorgaben und technische Erläuterungen.</p><Markdown text={clarifications}/>{documents.map(document => <details key={document.title}><summary>{document.title}</summary><a download={`${document.title.split(' · ')[0].replaceAll(' ','-')}.md`} href={`data:text/markdown;charset=utf-8,${encodeURIComponent(document.text)}`}>Originaldatei herunterladen</a><Markdown text={document.text}/></details>)}</details>}
  </div>;
}
