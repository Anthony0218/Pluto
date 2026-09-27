import { Link } from "react-router-dom";
import { SchafkopfRules } from "../../components/Schafkopf/SchafkopfTable";
import "../../components/Schafkopf/schafkopf.css";

export default function SchafKopfMenuPage() {
  return <main className="sk-page"><header className="sk-header"><div><span className="sk-eyebrow">Vier Spieler. Acht Stiche. Ein gutes Blatt.</span><h1>Schafkopf</h1><p>Rufspiel, Farbwenz, Wenz, Solo, Tout und Sie — mit verbindlichem Zugeben.</p></div><div className="sk-header-actions"><Link className="sk-button sk-secondary" to="/games/schafkopf/multiplayer">Spieltage & Spielstände</Link><Link className="sk-button sk-secondary" to="/games">Alle Spiele</Link></div></header>
    <div className="sk-mode-grid">
      <Link to="/games/schafkopf/hotseat" className="sk-panel sk-mode"><span aria-hidden="true">♧</span><h2>Hotseat</h2><p>Zu viert an einem Gerät. Verdeckte Übergabe schützt jede Hand.</p><strong>Gemeinsam spielen →</strong></Link>
      <Link to="/games/schafkopf/ai" className="sk-panel sk-mode"><span aria-hidden="true">♤</span><h2>Gegen KI</h2><p>Ein Platz für dich, drei für die KI. Übe Ansagen, Trumpf und Partnerspiel.</p><strong>Platz nehmen →</strong></Link>
      <Link to="/games/schafkopf/multiplayer" className="sk-panel sk-mode"><span aria-hidden="true">♢</span><h2>Spieltage & Blätter</h2><p>Gespeicherte Spielstände und Blätter auflisten, einen vorhandenen Tisch öffnen oder einen neuen Spieltag starten.</p><strong>Spieltage öffnen →</strong></Link>
    </div><SchafkopfRules /></main>;
}
