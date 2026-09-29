import { Link } from "react-router-dom";
import { SchafkopfRules } from "../../components/Schafkopf/SchafkopfTable";
import "../../components/Schafkopf/schafkopf.css";

export default function SchafKopfMenuPage() {
  return <main className="sk-page"><header className="sk-header"><div><span className="sk-eyebrow">Vier Spieler. Acht Stiche. Ein gutes Blatt.</span><h1>Schafkopf</h1><p>Rufspiel, Farbwenz, Wenz, Solo, Tout und Sie — mit verbindlichem Zugeben.</p></div><Link className="sk-button sk-secondary" to="/games">Alle Spiele</Link></header>
    <div className="sk-mode-grid">
      <Link to="/games/schafkopf/ai" className="sk-panel sk-mode"><span aria-hidden="true">♤</span><h2>Einzelspieler</h2><p>Spiele mit drei KI-Gegnern.</p><strong>Spielen →</strong></Link>
      <Link to="/games/schafkopf/multiplayer" className="sk-panel sk-mode"><span aria-hidden="true">♢</span><h2>Mehrspieler</h2><p>Privaten Tisch erstellen und Code teilen.</p><strong>Tisch öffnen →</strong></Link>
      <Link to="/games/schafkopf/hotseat" className="sk-panel sk-mode"><span aria-hidden="true">♧</span><h2>Hotseat</h2><p>Zu viert an einem Gerät spielen.</p><strong>Gemeinsam spielen →</strong></Link>
    </div><SchafkopfRules /></main>;
}
