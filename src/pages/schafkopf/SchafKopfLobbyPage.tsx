import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { recordCreatedGameInvite } from "@/components/social/GameInviteDelivery";
import { useInviteAutoCreate } from "@/hooks/useInviteAutoCreate";
import { useInviteAutoJoin } from "@/hooks/useInviteAutoJoin";
import { useAuth } from "../../context/AuthContext";
import { schafkopfRequest } from "../../games/schafkopf/multiplayer";
import "../../components/Schafkopf/schafkopf.css";

export default function SchafKopfLobbyPage() {
  useGameLanguage();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => (new URLSearchParams(window.location.search).get("code") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = profile?.display_name || profile?.username || "Spieler";
  async function openRoom(create: boolean) {
    if (busy || !user) return;
    setBusy(true); setError(null);
    try {
      let avatar = 2;
      try { const saved = localStorage.getItem(`schafkopf-own-avatar-${user.id}`); const index = saved === null ? JSON.parse(localStorage.getItem("schafkopf-avatars") ?? "[2]")[0] : Number(saved); if (Number.isInteger(index) && index >= 0 && index <= 5) avatar = index; } catch { /* Default avatar. */ }
      const room = await schafkopfRequest(create
        ? { op: "create", name, avatar, title: "Spieltag", aiDifficulty: "beginner" }
        : { op: "join", code, name, avatar });
      if (room) navigate(recordCreatedGameInvite(`/games/schafkopf/multiplayer/${room.code}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Raum konnte nicht geöffnet werden."); }
    finally { setBusy(false); }
  }
  // Friend invites open this page with `?create=1` (host a table) or `?code=…&join=1` (take a seat).
  useInviteAutoCreate(() => openRoom(true));
  useInviteAutoJoin(() => openRoom(false));
  return <main className="sk-page"><header className="sk-header"><div><span className="sk-eyebrow">{gameUi("Privater Tisch · Vier Spieler")}</span><h1>{gameUi("Schafkopf online")}</h1><p>{gameUi("Raum erstellen, Code teilen und gemeinsam spielen.")}</p></div><Link className="sk-button sk-secondary" to="/games/schafkopf">{gameUi("Zurück")}</Link></header>
    {loading ? <p>{gameUi("Anmeldung wird geladen …")}</p> : !user ? <section className="sk-panel sk-login"><h2>{gameUi("Melde dich zum Mitspielen an")}</h2><p>{gameUi("Dein Konto hält deinen Platz frei, auch wenn du die Seite neu lädst.")}</p><Link className="sk-button" to="/login">{gameUi("Anmelden")}</Link></section> : <><p>{gameUi("Du spielst als ")}<strong>{gameUi(name)}</strong>.</p><div className="sk-lobby-grid">
      <section className="sk-panel"><h2>{gameUi("Neuen Tisch erstellen")}</h2><p>{gameUi("Standardregeln mit 32 Karten, Kontra/Re und virtueller Punktewertung. Es werden vier angemeldete Spieler benötigt.")}</p><button className="sk-button" disabled={busy} onClick={() => void openRoom(true)}>{gameUi(busy ? "Bitte warten …" : "Tisch erstellen")}</button></section>
      <form className="sk-panel" onSubmit={event => { event.preventDefault(); void openRoom(false); }}><h2>{gameUi("Einem Tisch beitreten")}</h2><label htmlFor="schafkopf-code">{gameUi("Sechsstelliger Raumcode")}</label><input id="schafkopf-code" className="sk-input" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} maxLength={6} minLength={6} required autoComplete="off" placeholder={gameUi("ABC123")} /><button className="sk-button" disabled={busy || code.length !== 6}>{gameUi("Beitreten")}</button></form>
    </div></>}{error && <p className="sk-error" role="alert">{gameUi(error)}</p>}</main>;
}
