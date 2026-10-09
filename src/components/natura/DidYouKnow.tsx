import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useState } from "react";
import type { ScenarioId } from "../../games/natura/naturaData";
import { NATURA_FACTS } from "../../games/natura/naturaFacts";
import "./wildModes.css";

/** Key by scenario at call sites so changing habitats begins with its first fact. */
export default function DidYouKnow({ scenario }: { scenario: ScenarioId }) {
  useGameLanguage();
  const [index, setIndex] = useState(0);
  const facts = NATURA_FACTS[scenario];
  const fact = facts[index % facts.length];
  return <aside className="nw-fact" aria-label={gameUi("Did you know? Animal facts")}>
    <div className="nw-fact-top"><strong>{gameUi("✦ Did you know?")}</strong><span>{gameUi(index % facts.length + 1)} / {gameUi(facts.length)}</span></div>
    <div className="nw-fact-body" aria-live="polite" aria-atomic="true">
      <small>{gameUi(fact.animal)}</small><h3>{gameUi(fact.title)}</h3><p>{gameUi(fact.text)}</p>
      <a href={fact.url} target="_blank" rel="noreferrer">{gameUi(fact.label)} ↗</a>
    </div>
    <button type="button" onClick={() => setIndex(value => (value + 1) % facts.length)}>{gameUi("Next fact →")}</button>
  </aside>;
}
