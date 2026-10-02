import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { schafkopfRequest } from "../../games/schafkopf/multiplayer";
import "../../components/Schafkopf/schafkopf.css";

export default function SchafKopfLobbyPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = profile?.display_name || profile?.username || "Spieler";
  async function openRoom(create: boolean) {
    if (busy || !user) return;
    setBusy(true); setError(null);
    try {
      const room = await schafkopfRequest(create
        ? { op: "create", name, title: "Spieltag", aiDifficulty: "amateur" }
        : { op: "join", code, name });
      if (room) navigate(`/games/schafkopf/multiplayer/${room.code}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Raum konnte nicht geöffnet werden."); }
    finally { setBusy(false); }
  }
  return <main className="sk-page"><header className="sk-header"><div><span className="sk-eyebrow">Privater Tisch · Vier Spieler</span><h1>Schafkopf online</h1><p>Raum erstellen, Code teilen und gemeinsam spielen.</p></div><Link className="sk-button sk-secondary" to="/games/schafkopf">Zurück</Link></header>
    {loading ? <p>Anmeldung wird geladen …</p> : !user ? <section className="sk-panel sk-login"><h2>Melde dich zum Mitspielen an</h2><p>Dein Konto hält deinen Platz frei, auch wenn du die Seite neu lädst.</p><Link className="sk-button" to="/login">Anmelden</Link></section> : <><p>Du spielst als <strong>{name}</strong>.</p><div className="sk-lobby-grid">
      <section className="sk-panel"><h2>Neuen Tisch erstellen</h2><p>Standardregeln mit 32 Karten, Kontra/Re und virtueller Punktewertung. Es werden vier angemeldete Spieler benötigt.</p><button className="sk-button" disabled={busy} onClick={() => void openRoom(true)}>{busy ? "Bitte warten …" : "Tisch erstellen"}</button></section>
      <form className="sk-panel" onSubmit={event => { event.preventDefault(); void openRoom(false); }}><h2>Einem Tisch beitreten</h2><label htmlFor="schafkopf-code">Sechsstelliger Raumcode</label><input id="schafkopf-code" className="sk-input" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} maxLength={6} minLength={6} required autoComplete="off" placeholder="ABC123" /><button className="sk-button" disabled={busy || code.length !== 6}>Beitreten</button></form>
    </div></>}{error && <p className="sk-error" role="alert">{error}</p>}</main>;
}
