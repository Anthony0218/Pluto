import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useState } from "react";
import type { PublicQuestion } from "../../games/atlas/publicQuestion";
import type { RaceView } from "../../games/atlas/serverRace";
import { FlagPrompt, FlagChoices, HigherLowerCards } from "./AtlasPartyPanels";
export function ArenaQuestionInput({question,disabled,onAnswer,topology}:{question:PublicQuestion|NonNullable<RaceView["question"]>;disabled:boolean;onAnswer:(answer:string|string[])=>void;topology:unknown}) {
  useGameLanguage();
  const [selected,setSelected]=useState<string[]>(()=>question.interaction==="ordering"?question.choices.map(c=>c.id):[]);
  if(question.interaction==="higher_lower")return <HigherLowerCards question={question} revealed={false} disabled={disabled} onAnswer={onAnswer}/>;
  if(question.interaction==="single_choice")return <><FlagPrompt question={question} topology={topology}/><FlagChoices question={question} disabled={disabled} onAnswer={onAnswer}/></>;
  if(question.interaction==="clues")return <><ol className="atlas-clues">{question.clues.map((text,i)=><li key={i}><p>{gameUi(text)}</p></li>)}</ol><div className="atlas-choice-grid">{question.choices.map(c=><button key={c.id} disabled={disabled} onClick={()=>onAnswer(c.id)}>{gameUi(c.label)}</button>)}</div></>;
  if(question.interaction==="ordering")return <><ol className="atlas-order-list">{selected.map((id,i)=><li key={id}><strong>{gameUi(question.choices.find(c=>c.id===id)?.label)}</strong><button aria-label={gameUi(`Move ${question.choices.find(c=>c.id===id)?.label} up`)} disabled={disabled||i===0} onClick={()=>setSelected(old=>{const next=[...old];[next[i-1],next[i]]=[next[i],next[i-1]];return next;})}>↑</button><button aria-label={gameUi(`Move ${question.choices.find(c=>c.id===id)?.label} down`)} disabled={disabled||i===selected.length-1} onClick={()=>setSelected(old=>{const next=[...old];[next[i+1],next[i]]=[next[i],next[i+1]];return next;})}>↓</button></li>)}</ol><button className="atlas-submit" disabled={disabled} onClick={()=>onAnswer(selected)}>{gameUi("Lock order")}</button></>;
  if(question.interaction==="multi_select")return <><div className="atlas-choice-grid">{question.choices.map(c=><button key={c.id} disabled={disabled} aria-pressed={selected.includes(c.id)} className={selected.includes(c.id)?"selected":""} onClick={()=>setSelected(old=>old.includes(c.id)?old.filter(id=>id!==c.id):[...old,c.id])}>{gameUi(c.label)}</button>)}</div><button className="atlas-submit" disabled={disabled} onClick={()=>onAnswer(selected)}>{gameUi("Submit selection")}</button></>;
  return null;
}
