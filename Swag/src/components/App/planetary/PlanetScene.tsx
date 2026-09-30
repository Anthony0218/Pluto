import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import { planets, type PlanetConfig } from "./planetConfig";
import "./planetScene.css";

function PlanetArt({ config }: { config: PlanetConfig }) {
  return <span className="solar-art" aria-hidden="true">
    <span className="solar-atmosphere" />
    {config.ring && <span className="solar-ring" />}
    <span className="solar-sphere" />
    <span className="solar-symbol">{config.symbol}</span>
    <span className="solar-detail solar-detail--one" />
    <span className="solar-detail solar-detail--two" />
  </span>;
}

function Planet({ config }: { config: PlanetConfig }) {
  const className = `solar-planet solar-planet--${config.tone} solar-position--${config.position}${config.primary ? " solar-planet--primary" : ""}`;
  const content = <>
    <PlanetArt config={config} />
    <strong className="solar-label">{ui(config.label)}</strong>
    {!config.primary && <span className="solar-status">{ui("In progress")}</span>}
  </>;

  return <Link to={config.route} aria-label={`${ui("Open")} ${ui(config.label)}`} className={className}>{content}</Link>;
}

function GoldenPluto() {
  return <div className="solar-planet solar-planet--gold solar-position--gold" role="note" aria-label={`Golden Pluto: ${ui("In progress")}`}>
    <span className="solar-art" aria-hidden="true">
      <span className="solar-atmosphere" /><span className="solar-ring" /><span className="solar-sphere" />
      <span className="solar-symbol">✦</span>
    </span>
    <strong className="solar-label">GOLDEN PLUTO</strong>
    <span className="solar-status">{ui("In progress")}</span>
  </div>;
}

export default function PlanetScene() {
  useUiLanguage();
  return <section className="solar-scene" aria-label={ui("Choose a game")}>
    <div className="solar-stars" aria-hidden="true" />
    <div className="solar-orbits" aria-hidden="true" />
    <div className="solar-grid">
      {planets.map(config => <Planet key={config.id} config={config} />)}
      <GoldenPluto />
    </div>
    <div className="solar-brand" aria-hidden="true"><span>PLUTO</span><small>GAME UNIVERSE</small><i /></div>
  </section>;
}
