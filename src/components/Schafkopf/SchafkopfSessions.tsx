import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { schafkopfRequest, type SessionSummary } from "../../games/schafkopf/multiplayer";

export default function SchafkopfSessions({ refreshKey = 0, currentCode, onNew }: { refreshKey?: number; currentCode?: string; onNew?: () => void }) {
  useGameLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    schafkopfRequest({ op: "list" }).then(items => {
      if (!cancelled) { setSessions(items); setError(null); setLoading(false); }
    }).catch(cause => {
      if (!cancelled) { setError(cause instanceof Error ? cause.message : "Spieltage konnten nicht geladen werden."); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [user, refreshKey]);
  async function remove(session: SessionSummary) {
    if (!user) return;
    const owner = session.hostId === user.id;
    const question = owner
      ? `„${session.title}“ für alle Teilnehmer endgültig löschen?`
      : `„${session.title}“ aus deiner Liste entfernen? Der Tisch bleibt für die anderen erhalten.`;
    if (!window.confirm(question)) return;
    setDeleting(session.code); setError(null);
    try {
      await schafkopfRequest({ op: "delete", code: session.code, version: session.version });
      setSessions(current => current.filter(item => item.code !== session.code));
      if (session.code === currentCode) navigate("/games/schafkopf/multiplayer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Spieltag konnte nicht entfernt werden.");
      try { setSessions(await schafkopfRequest({ op: "list" })); } catch { /* Show the original error. */ }
    } finally { setDeleting(null); }
  }
  if (!user) return <p>{gameUi("Melde dich an, um deine gespeicherten Spieltage zu sehen.")}</p>;
  return <section className="sk-sessions" aria-label={gameUi("Gespeicherte Spieltage")}>
    <div className="sk-sessions-heading"><div><h3>{gameUi("Deine Spieltage")}</h3><p>{gameUi("Online-Runden und KI-Besetzungen werden automatisch in deinem Konto gespeichert.")}</p></div>{onNew ? <button type="button" className="sk-button sk-secondary" onClick={onNew}>{gameUi("Neuer Spieltag")}</button> : <Link className="sk-button sk-secondary" to="/games/schafkopf/multiplayer">{gameUi("Neuer Spieltag")}</Link>}</div>
    {loading ? <p>{gameUi("Spieltage werden geladen …")}</p> : sessions.length === 0 ? <p>{gameUi("Noch kein Spieltag gespeichert. Erstelle einen neuen Tisch.")}</p> : <ul className="sk-session-list">{sessions.map(session => { const seated = session.players.some(player => player.id === user.id); return <li key={session.code} className="sk-session-item">
      <div className="sk-session-main"><strong>{gameUi(session.title)}</strong><small>{gameUi(new Date(session.updatedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }))} · {gameUi(session.round ? `Runde ${session.round}` : "Wartetisch")} · {gameUi(session.code)}</small><span>{gameUi(session.players.map(player => `${player.name}${player.bot ? " (KI)" : ""}`).join(" · "))}{gameUi(session.players.length < 4 ? ` · ${4 - session.players.length} freie Plätze` : "")}</span></div>
      {session.totals && <div className="sk-session-scores" aria-label={gameUi("Spielstände in Cent")}>{session.players.map((player, seat) => <span key={player.id}>{player.name}: <strong>{gameUi(session.pendingSeats?.includes(seat) ? 0 : session.totals?.[seat] ?? 0)}{gameUi(" Cent")}</strong>{gameUi(session.pendingSeats?.includes(seat) ? " (ab nächster Runde)" : "")}</span>)}{session.formerPlayers?.map((player, index) => <span key={`${player.id}-${index}`}>{player.name}: <strong>{gameUi(player.total)}{gameUi(" Cent")}</strong>{gameUi(" (bis Runde ")}{gameUi(player.round)})</span>)}</div>}
      <div className="sk-session-actions"><Link className="sk-button sk-secondary" to={seated ? `/games/schafkopf/multiplayer/${session.code}` : "/games/schafkopf/multiplayer"}>{gameUi(seated ? "Öffnen" : "Erneut beitreten")}</Link><button type="button" className="sk-button sk-danger" disabled={deleting === session.code} onClick={() => void remove(session)}>{gameUi(session.hostId === user.id ? "Löschen" : "Aus Liste entfernen")}</button></div>
    </li>; })}</ul>}
    {error && <p className="sk-error" role="alert">{gameUi(error)}</p>}
  </section>;
}
