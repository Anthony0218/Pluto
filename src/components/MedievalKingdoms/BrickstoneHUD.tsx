import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useState } from "react";
import { ArrowUp, Bird, Check, Footprints, Heart, ScrollText, Shield, ShieldOff, Sparkles, Sword, Swords, Target, Zap } from "lucide-react";
import type { BrickstoneUnit, CampaignEffect, CampaignLogEntry } from "../../games/MedievalKingdoms/brickstoneData";

const EFFECT_ICONS = { rally: ArrowUp, shield: Shield, wound: ShieldOff, haste: Footprints };

function CharacterHUD({ selected }: { selected: BrickstoneUnit | null }) {
  useGameLanguage();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if (!selected) return <div className="brickstone-empty brickstone-character-empty"><Shield size={42} /><h3>{gameUi("Awaiting your command")}</h3><p>{gameUi("Select a unit in the field to inspect its stats and effects.")}</p></div>;
  const { unit, role } = selected;
  return <div className="brickstone-character brickstone-reveal" key={unit.id}>
    <div className="brickstone-portrait">
      {unit.ringImage && failedImage !== unit.ringImage ? <img src={unit.ringImage} alt={gameUi(`${unit.name} portrait`)} onError={() => setFailedImage(unit.ringImage ?? null)} /> : <Shield size={70} aria-label={gameUi("Unit crest")} />}
      <span>{gameUi(unit.tier)}{gameUi(" company")}</span>
    </div>
    <div className="brickstone-unit-info">
      <p className="brickstone-eyebrow">{gameUi(role)}</p><h3>{gameUi(unit.name)}</h3>
      <div className="brickstone-health-label"><span><Heart size={15} />{gameUi(" Health")}</span><strong>{gameUi(unit.health)} <small>/ {gameUi(unit.maxHealth)}</small></strong></div>
      <div className="brickstone-health" role="meter" aria-label={gameUi("Health")} aria-valuenow={unit.health} aria-valuemin={0} aria-valuemax={unit.maxHealth}><span style={{ width: `${unit.health / unit.maxHealth * 100}%` }} /></div>
      <dl className="brickstone-stats">
        <div><dt><Swords size={15} />{gameUi(" Impact")}</dt><dd>{gameUi(unit.impact)}</dd></div>
        <div><dt><Zap size={15} />{gameUi(" Agility")}</dt><dd>{gameUi(unit.agility)}</dd></div>
        <div><dt><Shield size={15} />{gameUi(" Toughness")}</dt><dd>{gameUi(unit.toughness)}</dd></div>
        <div><dt><Sword size={15} />{gameUi(" Damage")}</dt><dd>{gameUi(unit.damage)}</dd></div>
      </dl>
      <div className="brickstone-movement"><Footprints size={16} /><span>{gameUi("Movement")}</span><strong>{gameUi(unit.moveRange)}{gameUi(" cm")}</strong></div>
    </div>
  </div>;
}

function EffectEntry({ effect }: { effect: CampaignEffect }) {
  useGameLanguage();
  const Icon = EFFECT_ICONS[effect.icon];
  return <li><span className="brickstone-effect-icon"><Icon size={21} /></span><div><div className="brickstone-effect-name"><strong>{gameUi(effect.title)}</strong>{effect.duration && <small>{gameUi(effect.duration)}</small>}</div><p>{gameUi(effect.description)}</p></div></li>;
}

function BuffDebuffPanel({ selected }: { selected: BrickstoneUnit | null }) {
  useGameLanguage();
  const [tab, setTab] = useState<"buffs" | "debuffs">("buffs");
  const effects = selected?.[tab] ?? [];
  return <>
    <div className="brickstone-effect-tabs" role="tablist" aria-label={gameUi("Unit effects")}>
      {(["buffs", "debuffs"] as const).map((key) => <button key={key} type="button" id={`brickstone-${key}-tab`} role="tab" aria-selected={tab === key} aria-controls="brickstone-effects-panel" tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "buffs" : event.key === "End" ? "debuffs" : tab === "buffs" ? "debuffs" : "buffs"; setTab(next); document.getElementById(`brickstone-${next}-tab`)?.focus(); } }}>
        {key === "buffs" ? <Sparkles size={16} /> : <ShieldOff size={16} />}{gameUi(key === "buffs" ? "Buffs" : "Debuffs")}<span>{gameUi(selected?.[key].length ?? 0)}</span>
      </button>)}
    </div>
    <div id="brickstone-effects-panel" role="tabpanel" aria-labelledby={`brickstone-${tab}-tab`} tabIndex={0} className={`brickstone-effects ${tab}`}>
      <div className="brickstone-reveal" key={`${selected?.unit.id}-${tab}`}>
        {effects.length ? <ul>{effects.map((effect) => <EffectEntry key={effect.id} effect={effect} />)}</ul> : <div className="brickstone-empty"><Check size={25} /><h3>{gameUi(selected ? `No active ${tab}` : "No unit selected")}</h3><p>{gameUi(selected ? tab === "debuffs" ? "Ready and unburdened." : "No beneficial effects at present." : "Select a unit to view its conditions.")}</p></div>}
      </div>
    </div>
  </>;
}

function CampaignLog({ entries }: { entries: CampaignLogEntry[] }) {
  useGameLanguage();
  return <ol className="brickstone-log" role="log" aria-label={gameUi("Campaign activity")} aria-live="polite" aria-relevant="additions" tabIndex={0}>
    {entries.map((entry) => <li key={entry.id}><time>{gameUi(entry.time)}</time><span className={`brickstone-log-icon ${entry.kind}`}>{entry.kind === "selection" ? <Target size={14} /> : <ScrollText size={14} />}</span><p>{gameUi(entry.message)}</p></li>)}
  </ol>;
}

export default function BrickstoneHUD({ selected, entries }: { selected: BrickstoneUnit | null; entries: CampaignLogEntry[] }) {
  useGameLanguage();
  const [mobilePanel, setMobilePanel] = useState<"character" | "effects" | "log">("character");
  return <section className="brickstone-hud" aria-label={gameUi("Campaign command interface")} data-panel={mobilePanel}>
    <div className="brickstone-hud-crest" aria-hidden="true"><Bird size={22} /></div>
    <nav className="brickstone-mobile-tabs" aria-label={gameUi("Command panels")}>{(["character", "effects", "log"] as const).map((panel) => <button key={panel} type="button" aria-pressed={mobilePanel === panel} aria-controls={`brickstone-${panel}`} onClick={() => setMobilePanel(panel)}>{gameUi(panel === "character" ? "Character" : panel === "effects" ? "Effects" : "Campaign log")}</button>)}</nav>
    <section className="brickstone-hud-panel" id="brickstone-character"><h2><Shield size={17} />{gameUi("Character")}<span>{gameUi(selected ? "Selected unit" : "No selection")}</span></h2><CharacterHUD selected={selected} /></section>
    <section className="brickstone-hud-panel" id="brickstone-effects"><h2><Sparkles size={17} />{gameUi("Conditions")}<span>{gameUi("Unit effects")}</span></h2><BuffDebuffPanel selected={selected} /></section>
    <section className="brickstone-hud-panel" id="brickstone-log"><h2><ScrollText size={17} />{gameUi("Campaign log")}<span>{gameUi(entries.length)}{gameUi(" entries")}</span></h2><CampaignLog entries={entries} /></section>
  </section>;
}
