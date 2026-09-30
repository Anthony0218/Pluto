import { useState } from "react";
import { ArrowUp, Bird, Check, Footprints, Heart, ScrollText, Shield, ShieldOff, Sparkles, Sword, Swords, Target, Zap } from "lucide-react";
import type { BrickstoneUnit, CampaignEffect, CampaignLogEntry } from "../../games/MedievalKingdoms/brickstoneData";

const EFFECT_ICONS = { rally: ArrowUp, shield: Shield, wound: ShieldOff, haste: Footprints };

function CharacterHUD({ selected }: { selected: BrickstoneUnit | null }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if (!selected) return <div className="brickstone-empty brickstone-character-empty"><Shield size={42} /><h3>Awaiting your command</h3><p>Select a unit in the field to inspect its stats and effects.</p></div>;
  const { unit, role } = selected;
  return <div className="brickstone-character brickstone-reveal" key={unit.id}>
    <div className="brickstone-portrait">
      {unit.ringImage && failedImage !== unit.ringImage ? <img src={unit.ringImage} alt={`${unit.name} portrait`} onError={() => setFailedImage(unit.ringImage ?? null)} /> : <Shield size={70} aria-label="Unit crest" />}
      <span>{unit.tier} company</span>
    </div>
    <div className="brickstone-unit-info">
      <p className="brickstone-eyebrow">{role}</p><h3>{unit.name}</h3>
      <div className="brickstone-health-label"><span><Heart size={15} /> Health</span><strong>{unit.health} <small>/ {unit.maxHealth}</small></strong></div>
      <div className="brickstone-health" role="meter" aria-label="Health" aria-valuenow={unit.health} aria-valuemin={0} aria-valuemax={unit.maxHealth}><span style={{ width: `${unit.health / unit.maxHealth * 100}%` }} /></div>
      <dl className="brickstone-stats">
        <div><dt><Swords size={15} /> Impact</dt><dd>{unit.impact}</dd></div>
        <div><dt><Zap size={15} /> Agility</dt><dd>{unit.agility}</dd></div>
        <div><dt><Shield size={15} /> Toughness</dt><dd>{unit.toughness}</dd></div>
        <div><dt><Sword size={15} /> Damage</dt><dd>{unit.damage}</dd></div>
      </dl>
      <div className="brickstone-movement"><Footprints size={16} /><span>Movement</span><strong>{unit.moveRange} cm</strong></div>
    </div>
  </div>;
}

function EffectEntry({ effect }: { effect: CampaignEffect }) {
  const Icon = EFFECT_ICONS[effect.icon];
  return <li><span className="brickstone-effect-icon"><Icon size={21} /></span><div><div className="brickstone-effect-name"><strong>{effect.title}</strong>{effect.duration && <small>{effect.duration}</small>}</div><p>{effect.description}</p></div></li>;
}

function BuffDebuffPanel({ selected }: { selected: BrickstoneUnit | null }) {
  const [tab, setTab] = useState<"buffs" | "debuffs">("buffs");
  const effects = selected?.[tab] ?? [];
  return <>
    <div className="brickstone-effect-tabs" role="tablist" aria-label="Unit effects">
      {(["buffs", "debuffs"] as const).map((key) => <button key={key} type="button" id={`brickstone-${key}-tab`} role="tab" aria-selected={tab === key} aria-controls="brickstone-effects-panel" tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "buffs" : event.key === "End" ? "debuffs" : tab === "buffs" ? "debuffs" : "buffs"; setTab(next); document.getElementById(`brickstone-${next}-tab`)?.focus(); } }}>
        {key === "buffs" ? <Sparkles size={16} /> : <ShieldOff size={16} />}{key === "buffs" ? "Buffs" : "Debuffs"}<span>{selected?.[key].length ?? 0}</span>
      </button>)}
    </div>
    <div id="brickstone-effects-panel" role="tabpanel" aria-labelledby={`brickstone-${tab}-tab`} tabIndex={0} className={`brickstone-effects ${tab}`}>
      <div className="brickstone-reveal" key={`${selected?.unit.id}-${tab}`}>
        {effects.length ? <ul>{effects.map((effect) => <EffectEntry key={effect.id} effect={effect} />)}</ul> : <div className="brickstone-empty"><Check size={25} /><h3>{selected ? `No active ${tab}` : "No unit selected"}</h3><p>{selected ? tab === "debuffs" ? "Ready and unburdened." : "No beneficial effects at present." : "Select a unit to view its conditions."}</p></div>}
      </div>
    </div>
  </>;
}

function CampaignLog({ entries }: { entries: CampaignLogEntry[] }) {
  return <ol className="brickstone-log" role="log" aria-label="Campaign activity" aria-live="polite" aria-relevant="additions" tabIndex={0}>
    {entries.map((entry) => <li key={entry.id}><time>{entry.time}</time><span className={`brickstone-log-icon ${entry.kind}`}>{entry.kind === "selection" ? <Target size={14} /> : <ScrollText size={14} />}</span><p>{entry.message}</p></li>)}
  </ol>;
}

export default function BrickstoneHUD({ selected, entries }: { selected: BrickstoneUnit | null; entries: CampaignLogEntry[] }) {
  const [mobilePanel, setMobilePanel] = useState<"character" | "effects" | "log">("character");
  return <section className="brickstone-hud" aria-label="Campaign command interface" data-panel={mobilePanel}>
    <div className="brickstone-hud-crest" aria-hidden="true"><Bird size={22} /></div>
    <nav className="brickstone-mobile-tabs" aria-label="Command panels">{(["character", "effects", "log"] as const).map((panel) => <button key={panel} type="button" aria-pressed={mobilePanel === panel} aria-controls={`brickstone-${panel}`} onClick={() => setMobilePanel(panel)}>{panel === "character" ? "Character" : panel === "effects" ? "Effects" : "Campaign log"}</button>)}</nav>
    <section className="brickstone-hud-panel" id="brickstone-character"><h2><Shield size={17} />Character<span>{selected ? "Selected unit" : "No selection"}</span></h2><CharacterHUD selected={selected} /></section>
    <section className="brickstone-hud-panel" id="brickstone-effects"><h2><Sparkles size={17} />Conditions<span>Unit effects</span></h2><BuffDebuffPanel selected={selected} /></section>
    <section className="brickstone-hud-panel" id="brickstone-log"><h2><ScrollText size={17} />Campaign log<span>{entries.length} entries</span></h2><CampaignLog entries={entries} /></section>
  </section>;
}
