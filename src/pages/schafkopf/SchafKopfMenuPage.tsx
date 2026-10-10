import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { Link } from "react-router-dom";
import { SchafkopfRules } from "../../components/Schafkopf/SchafkopfTable";
import SchafkopfInterfaceSelector from "../../components/Schafkopf/SchafkopfInterfaceSelector";
import { useSchafkopfInterface } from "../../components/Schafkopf/useSchafkopfInterface";
import "../../components/Schafkopf/schafkopf.css";

export default function SchafKopfMenuPage() {
  useGameLanguage();
  const [interfaceMode, selectInterface] = useSchafkopfInterface();
  return <main className="sk-page"><header className="sk-header"><div><span className="sk-eyebrow">{gameUi("Vier Spieler. Acht Stiche. Ein gutes Blatt.")}</span><h1>{gameUi("Schafkopf")}</h1><p>{gameUi("Rufspiel, Farbwenz, Wenz, Solo, Tout und Sie — mit verbindlichem Zugeben.")}</p></div><Link className="sk-button sk-secondary" to="/games">{gameUi("Alle Spiele")}</Link></header>
    <section className="sk-interface-setting"><div><h2>{gameUi("Deine Spielansicht")}</h2><p>{gameUi("Schlicht: Tisch von oben ohne Spielerfiguren. Wähle im Spiel zwischen Filz und Schafkopftisch mit Brotzeit.")}</p></div><SchafkopfInterfaceSelector value={interfaceMode} onChange={selectInterface} /></section>
    <div className="sk-mode-grid">
      <Link to="/games/schafkopf/ai" className="sk-panel sk-mode"><span aria-hidden="true">♤</span><h2>{gameUi("Einzelspieler")}</h2><p>{gameUi("Spiele mit drei KI-Gegnern.")}</p><strong>{gameUi("Spielen →")}</strong></Link>
      <Link to="/games/schafkopf/multiplayer" className="sk-panel sk-mode"><span aria-hidden="true">♢</span><h2>{gameUi("Mehrspieler")}</h2><p>{gameUi("Privaten Tisch erstellen und Code teilen.")}</p><strong>{gameUi("Tisch öffnen →")}</strong></Link>
      <Link to="/games/schafkopf/hotseat" className="sk-panel sk-mode"><span aria-hidden="true">♧</span><h2>{gameUi("Hotseat")}</h2><p>{gameUi("Zu viert an einem Gerät spielen.")}</p><strong>{gameUi("Gemeinsam spielen →")}</strong></Link>
    </div><SchafkopfRules /></main>;
}
