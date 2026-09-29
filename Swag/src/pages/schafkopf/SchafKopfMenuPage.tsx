import { Link, useSearchParams } from "react-router-dom";
import { SchafkopfRules } from "../../components/Schafkopf/SchafkopfTable";
import "../../components/Schafkopf/schafkopf.css";

export default function SchafKopfMenuPage() {
  return <main className="sk-page"><header className="sk-header"><div><span className="sk-eyebrow">Vier Spieler. Acht Stiche. Ein gutes Blatt.</span><h1>Schafkopf</h1><p>Rufspiel, Farbwenz, Wenz, Solo, Tout und Sie — mit verbindlichem Zugeben.</p></div><Link className="sk-button sk-secondary" to="/games">Alle Spiele</Link></header>
    <div className="sk-mode-grid">
      <Link to="/games/schafkopf/hotseat" className="sk-panel sk-mode"><span aria-hidden="true">♧</span><h2>Hotseat</h2><p>Zu viert an einem Gerät. Verdeckte Übergabe schützt jede Hand.</p><strong>Gemeinsam spielen →</strong></Link>
      <Link to="/games/schafkopf/ai" className="sk-panel sk-mode"><span aria-hidden="true">♤</span><h2>Gegen KI</h2><p>Ein Platz für dich, drei für die KI. Übe Ansagen, Trumpf und Partnerspiel.</p><strong>Platz nehmen →</strong></Link>
      <Link to="/games/schafkopf/multiplayer" className="sk-panel sk-mode"><span aria-hidden="true">♢</span><h2>Multiplayer</h2><p>Erstelle einen privaten Tisch und lade drei Freunde mit dem Raumcode ein.</p><strong>Tisch finden →</strong></Link>
    </div><SchafkopfRules /></main>;
}
