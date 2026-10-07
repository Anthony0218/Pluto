import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bird, BowArrow, Castle, ChevronLeft, Compass, Flag, Footprints, Package, ScanLine, Shield, Swords, Users, X } from "lucide-react";
import BrickstoneHUD from "../../../components/MedievalKingdoms/BrickstoneHUD";
import RangeZone from "../../../components/MedievalKingdoms/RangeZone";
import { BRICKSTONE_SCENE, BRICKSTONE_UNITS, type BrickstoneUnit, type CampaignLogEntry } from "../../../games/MedievalKingdoms/brickstoneData";
import "./brickstoneFortress.css";

const UNIT_SYMBOLS = { shield: Shield, swords: Swords, rider: Footprints, bow: BowArrow };

function UnitMarker({ entry, selected, index, onSelect }: { entry: BrickstoneUnit; selected: boolean; index: number; onSelect: () => void }) {
  const Icon = UNIT_SYMBOLS[entry.symbol];
  const { unit } = entry;
  return <div className="brickstone-unit-anchor" style={{ left: `${unit.position.x}%`, top: `${unit.position.y}%`, animationDelay: `${150 + index * 90}ms` }}>
    <button type="button" className={`brickstone-unit ${unit.faction === "falconstone" ? "friendly" : "enemy"}`} aria-label={`${unit.name}, ${entry.role}, ${unit.health} of ${unit.maxHealth} health`} aria-pressed={selected} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <Icon size={29} strokeWidth={1.6} aria-hidden="true" />
      {selected && <span className="brickstone-selection" aria-hidden="true"><i /><i /><i /><i /></span>}
      <span className="brickstone-token-label">{unit.name}{selected && <small>Selected</small>}</span>
    </button>
    <span className="brickstone-unit-shadow" aria-hidden="true" />
  </div>;
}

export default function BrickstoneFortressPage() {
  const [selectedId, setSelectedId] = useState<string | null>(BRICKSTONE_SCENE.initialUnitId);
  const [showRange, setShowRange] = useState(true);
  const [fortressOpen, setFortressOpen] = useState(false);
  const [entries, setEntries] = useState<CampaignLogEntry[]>(() => [...BRICKSTONE_SCENE.initialLog]);
  const nextLogId = useRef(4);
  const fortressButton = useRef<HTMLButtonElement>(null);
  const selected = BRICKSTONE_UNITS.find(({ unit }) => unit.id === selectedId) ?? null;
  const fortress = BRICKSTONE_SCENE.fortress;

  function selectUnit(entry: BrickstoneUnit) {
    if (entry.unit.id === selectedId) return;
    setSelectedId(entry.unit.id);
    setFortressOpen(false);
    const item: CampaignLogEntry = { id: nextLogId.current++, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), message: `${entry.unit.name} selected. ${entry.role.split(" · ")[1]} standing by.`, kind: "selection" };
    setEntries((current) => [item, ...current].slice(0, 30));
  }

  function clearSelection() { setSelectedId(null); setFortressOpen(false); }

  return <main className="brickstone" aria-label="Brickstone Fortress campaign location" onKeyDown={(event) => {
    if (event.key === "Escape") { if (fortressOpen) { setFortressOpen(false); fortressButton.current?.focus(); } else setSelectedId(null); }
  }}>
    <header className="brickstone-topbar">
      <Link to="/games/medieval-kingdoms/legacy" className="brickstone-back"><ChevronLeft size={17} /><span>Continent map</span></Link>
      <div className="brickstone-title"><Castle size={23} /><div><p>Medieval Kingdoms</p><h1>{BRICKSTONE_SCENE.name}</h1></div></div>
      <div className="brickstone-faction"><Bird size={18} /><span>Falconstone</span></div>
    </header>

    <section className="brickstone-scene" aria-label="Fortress approach, four selectable units">
      <div className="brickstone-scene-viewport"><div className="brickstone-world">
        <img className="brickstone-landscape" src={BRICKSTONE_SCENE.image} alt="A winding mountain road leads through meadows to Brickstone Fortress on the northeastern cliffs." draggable={false} />
        <button type="button" className="brickstone-terrain" aria-label="Clear unit selection" tabIndex={-1} onClick={clearSelection} />
        {selected && showRange && <div className="brickstone-range-layer" aria-hidden="true" key={selected.unit.id}><RangeZone x={selected.unit.position.x} y={selected.unit.position.y} range={selected.unit.moveRange * BRICKSTONE_SCENE.rangePreviewScale} type="move" /></div>}
        {BRICKSTONE_UNITS.map((entry, index) => <UnitMarker key={entry.unit.id} entry={entry} selected={entry.unit.id === selectedId} index={index} onSelect={() => selectUnit(entry)} />)}
        <button ref={fortressButton} type="button" className="brickstone-fortress-marker" style={{ left: `${fortress.x}%`, top: `${fortress.y}%` }} aria-label="Inspect Brickstone Fortress" aria-expanded={fortressOpen} aria-controls="brickstone-fortress-card" onClick={() => setFortressOpen((open) => !open)}><Castle size={18} /><span>Brickstone Fortress<small><Flag size={11} />{fortress.status}</small></span></button>
      </div></div>

      <div className="brickstone-scene-caption"><span className="brickstone-eyebrow">Campaign location</span><p>{BRICKSTONE_SCENE.subtitle}</p></div>
      <div className="brickstone-compass" aria-hidden="true"><span>N</span><Compass size={34} strokeWidth={1} /></div>
      {fortressOpen && <aside id="brickstone-fortress-card" className="brickstone-fortress-card brickstone-reveal" aria-label="Fortress information">
        <div className="brickstone-card-heading"><Castle size={23} /><div><p className="brickstone-eyebrow">Northern stronghold</p><h2>Brickstone Fortress</h2></div><button type="button" aria-label="Close fortress information" onClick={() => { setFortressOpen(false); fortressButton.current?.focus(); }}><X size={17} /></button></div>
        <p className="brickstone-contested"><Flag size={14} />{fortress.status}<span>The mountain road remains watched.</span></p>
        <dl><div><dt><Users size={16} />Garrison</dt><dd>{fortress.garrison} troops</dd></div><div><dt><Package size={16} />Supplies</dt><dd>{fortress.supplies}</dd></div><div><dt><Shield size={16} />Defenses</dt><dd>{fortress.defenses}</dd></div></dl>
        <p className="brickstone-sample-note">Provisional scout report</p>
      </aside>}
      <footer className="brickstone-scene-tools"><span><span className="brickstone-friendly-key" />Falconstone<span className="brickstone-enemy-key" />Blackthorn</span><button type="button" aria-pressed={showRange} onClick={() => setShowRange((value) => !value)}><ScanLine size={16} />Range preview {showRange ? "on" : "off"}</button></footer>
    </section>

    <BrickstoneHUD selected={selected} entries={entries} />
    <footer className="brickstone-bottom"><span><Flag size={13} />Northern approach</span><span>Select a unit to inspect<span className="brickstone-desktop-hint"> · Esc to clear</span></span><span>Campaign preview</span></footer>
  </main>;
}
