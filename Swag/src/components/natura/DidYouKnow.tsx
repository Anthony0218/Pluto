import { useState } from "react";
import type { ScenarioId } from "../../games/natura/naturaData";
import { NATURA_FACTS } from "../../games/natura/naturaFacts";
import "./wildModes.css";

/** Key by scenario at call sites so changing habitats begins with its first fact. */
export default function DidYouKnow({ scenario }: { scenario: ScenarioId }) {
  const [index, setIndex] = useState(0);
  const facts = NATURA_FACTS[scenario];
  const fact = facts[index % facts.length];
  return <aside className="nw-fact" aria-label="Did you know? Animal facts">
    <div className="nw-fact-top"><strong>✦ Did you know?</strong><span>{index % facts.length + 1} / {facts.length}</span></div>
    <div className="nw-fact-body" aria-live="polite" aria-atomic="true">
      <small>{fact.animal}</small><h3>{fact.title}</h3><p>{fact.text}</p>
      <a href={fact.url} target="_blank" rel="noreferrer">{fact.label} ↗</a>
    </div>
    <button type="button" onClick={() => setIndex(value => (value + 1) % facts.length)}>Next fact →</button>
  </aside>;
}
