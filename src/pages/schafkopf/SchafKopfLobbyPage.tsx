import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { schafkopfRequest } from "../../games/schafkopf/multiplayer";
import { AI_DIFFICULTY_OPTIONS, type AiDifficulty } from "../../games/schafkopf/schafkopf";
import SchafkopfSessions from "../../components/Schafkopf/SchafkopfSessions";
import "../../components/Schafkopf/schafkopf.css";

export default function SchafKopfLobbyPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState(() => `Spieltag ${new Date().toLocaleDateString("de-DE")}`);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>("amateur");
  const [activeTab, setActiveTab] = useState<"new" | "scores">("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = profile?.display_name || profile?.username || "Spieler";
  async function openRoom(create: boolean) {
    if (busy || !user) return;
    setBusy(true); setError(null);
    try {
      const room = await schafkopfRequest(create ? { op: "create", name, title, aiDifficulty } : { op: "join", code, name });
      if (room) navigate(`/games/schafkopf/multiplayer/${room.code}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Raum konnte nicht geöffnet werden."); }
    finally { setBusy(false); }
  }
  return <main className="sk-page"><header className="sk-header"><div><span className="sk-eyebrow">Privater Tisch · Vier Plätze</span><h1>Schafkopf online</h1><p>Spiele mit Freunden; freie Plätze können KI-Spieler übernehmen.</p></div><Link className="sk-button sk-secondary" to="/games/schafkopf">Zurück</Link></header>
    {loading ? <p>Anmeldung wird geladen …</p> : !user ? <section className="sk-panel sk-login"><h2>Melde dich zum Mitspielen an</h2><p>Dein Konto speichert deine Spieltage und hält deinen Platz frei.</p><Link className="sk-button" to="/login">Anmelden</Link></section> : <><div className="sk-session-tabs" role="tablist" aria-label="Multiplayer-Bereich"><button type="button" id="sk-new-tab" role="tab" aria-controls="sk-new-panel" aria-selected={activeTab === "new"} className={activeTab === "new" ? "is-selected" : ""} onClick={() => setActiveTab("new")}>Neuer Spieltag</button><button type="button" id="sk-scores-tab" role="tab" aria-controls="sk-scores-panel" aria-selected={activeTab === "scores"} className={activeTab === "scores" ? "is-selected" : ""} onClick={() => setActiveTab("scores")}>Spielstände</button></div>{activeTab === "new" ? <div id="sk-new-panel" role="tabpanel" aria-labelledby="sk-new-tab"><p>Du spielst als <strong>{name}</strong>.</p><div className="sk-lobby-grid">
      <section className="sk-panel"><h2>Neuen Spieltag erstellen</h2><p>Bis zu drei freie Plätze werden beim Start mit KI besetzt. Weitere Menschen können vorher per Code beitreten.</p><label className="sk-lobby-field" htmlFor="sk-session-title">Name des Spieltags<input id="sk-session-title" value={title} maxLength={60} onChange={event => setTitle(event.target.value)} placeholder="Zum Beispiel: Sonntagsrunde" /></label><label className="sk-lobby-field" htmlFor="sk-lobby-ai">KI-Spielstärke<select id="sk-lobby-ai" value={aiDifficulty} onChange={event => setAiDifficulty(event.target.value as AiDifficulty)}>{AI_DIFFICULTY_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><button className="sk-button" disabled={busy || !title.trim()} onClick={() => void openRoom(true)}>{busy ? "Bitte warten …" : "Spieltag erstellen"}</button></section>
      <form className="sk-panel" onSubmit={event => { event.preventDefault(); void openRoom(false); }}><h2>Einem Tisch beitreten</h2><label htmlFor="schafkopf-code">Sechsstelliger Raumcode</label><input id="schafkopf-code" className="sk-input" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} maxLength={6} minLength={6} required autoComplete="off" placeholder="ABC123" /><button className="sk-button" disabled={busy || code.length !== 6}>Beitreten</button></form>
    </div></div> : <div id="sk-scores-panel" role="tabpanel" aria-labelledby="sk-scores-tab"><SchafkopfSessions onNew={() => setActiveTab("new")} /></div>}</>}{error && <p className="sk-error" role="alert">{error}</p>}</main>;
}
